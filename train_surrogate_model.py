import os
import joblib
import numpy as np
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

# Import preprocessor from data_pipeline
from data_pipeline import preprocess_and_window_data

# Configurable constants for physics loss weighting
LAMBDA_DATA = 1.0
LAMBDA_PHYSICS = 0.1       # Hinge penalty weight to enforce monotonic degradation
LAMBDA_CONSISTENCY = 0.05  # RPM-Gated Consistency loss weight

def data_loss_metric(y_true, y_pred):
    """
    Computes data-fitting MSE term on actual 6 targets.
    """
    y_true_actual = y_true[:, :6]
    return tf.reduce_mean(tf.square(y_true_actual - y_pred))

def physics_loss_metric(y_true, y_pred):
    """
    Computes monotonic degradation penalty within sequential cycles of the same engine.
    Penalizes instances where health_pred[t+1] > health_pred[t] for health targets (0-3).
    """
    batch_engine_ids = y_true[:, 6]
    diff_pred = y_pred[1:, :4] - y_pred[:-1, :4]
    
    same_engine = tf.cast(tf.equal(batch_engine_ids[1:], batch_engine_ids[:-1]), tf.float32)
    hinge_penalty = tf.maximum(0.0, diff_pred)
    
    return tf.reduce_mean(hinge_penalty * tf.expand_dims(same_engine, axis=-1))

def consistency_loss_metric(y_true, y_pred):
    """
    Enforces that physical pressure ratios correlate with predicted health
    ONLY when the engine throttle (RPM) is stable.
    y_true indices: 6 = engine_id, 7 = RPM, 8 = CPR, 9 = TER
    """
    batch_engine_ids = y_true[:, 6]
    
    diff_rpm = tf.abs(y_true[1:, 7] - y_true[:-1, 7])
    diff_cpr = y_true[1:, 8] - y_true[:-1, 8]
    diff_ter = y_true[1:, 9] - y_true[:-1, 9]
    
    # Compressor Health (index 0) and Turbine Health (index 2)
    diff_pred_comp = y_pred[1:, 0] - y_pred[:-1, 0]
    diff_pred_turb = y_pred[1:, 2] - y_pred[:-1, 2]
    
    same_engine = tf.cast(tf.equal(batch_engine_ids[1:], batch_engine_ids[:-1]), tf.float32)
    # Stable if scaled RPM changes by < 5% (i.e., avoiding Takeoff/Cruise jumps)
    stable_rpm = tf.cast(diff_rpm < 0.05, tf.float32) 
    valid_mask = same_engine * stable_rpm
    
    # Penalty: If CPR and Health move in opposite directions, diff_cpr * diff_pred_comp is negative
    cpr_penalty = tf.maximum(0.0, -diff_cpr * diff_pred_comp)
    ter_penalty = tf.maximum(0.0, -diff_ter * diff_pred_turb)
    
    return tf.reduce_mean((cpr_penalty + ter_penalty) * valid_mask)

def custom_physics_loss(y_true, y_pred):
    """
    Combined physics-informed loss function.
    """
    dl = LAMBDA_DATA * data_loss_metric(y_true, y_pred)
    pl = LAMBDA_PHYSICS * physics_loss_metric(y_true, y_pred)
    cl = LAMBDA_CONSISTENCY * consistency_loss_metric(y_true, y_pred)
    return dl + pl + cl

def build_and_compile_model(use_physics_loss=True):
    model = Sequential([
        LSTM(32, activation='tanh', input_shape=(5, 15), name="LSTM_Layer"),
        Dropout(0.3, name="Dropout_Regularization"),
        Dense(16, activation='relu', name="Hidden_Dense_Layer"),
        Dense(6, activation='linear', name="Output_Layer")
    ])
    
    optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
    
    if use_physics_loss:
        model.compile(
            optimizer=optimizer,
            loss=custom_physics_loss,
            metrics=[data_loss_metric, physics_loss_metric, consistency_loss_metric]
        )
    else:
        model.compile(
            optimizer=optimizer,
            loss='mse',
            metrics=['mae']
        )
        
    return model

def compute_fine_grained_metrics(y_true, y_pred, X_val, scaler_x):
    targets = ['Compressor', 'Combustor', 'Turbine', 'Overall']
    metrics_per_target = {}
    
    for i in range(4):
        mse = mean_squared_error(y_true[:, i], y_pred[:, i])
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_true[:, i], y_pred[:, i])
        r2 = r2_score(y_true[:, i], y_pred[:, i])
        metrics_per_target[targets[i]] = {'RMSE': rmse, 'MAE': mae, 'R2': r2}
        
    # Infer Flight Phase based on unscaled Altitude_m
    samples = X_val.shape[0]
    X_val_flat = X_val.reshape(-1, 15)
    X_val_unscaled_flat = scaler_x.inverse_transform(X_val_flat)
    X_val_unscaled = X_val_unscaled_flat.reshape(samples, 5, 15)
    
    altitudes = X_val_unscaled[:, 4, 0]
    cruise_mask = altitudes >= 3000
    takeoff_mask = altitudes < 3000
    
    phase_metrics = {'Cruise': {}, 'Takeoff_Ground': {}}
    if np.sum(cruise_mask) > 0:
        for i in range(4):
            phase_metrics['Cruise'][targets[i]] = mean_absolute_error(y_true[cruise_mask, i], y_pred[cruise_mask, i])
    if np.sum(takeoff_mask) > 0:
        for i in range(4):
            phase_metrics['Takeoff_Ground'][targets[i]] = mean_absolute_error(y_true[takeoff_mask, i], y_pred[takeoff_mask, i])
            
    return metrics_per_target, phase_metrics

def train_model():
    dataset_path = "turbojet_complete_dataset.csv"
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data(dataset_path)

    folds = [
        {'name': 'Fold 1', 'val_engines': [1, 2, 3]},
        {'name': 'Fold 2', 'val_engines': [4, 5, 6]},
        {'name': 'Fold 3', 'val_engines': [7, 8, 9, 10]}
    ]
    
    all_fold_metrics = []
    all_phase_metrics = []

    print("\n=======================================================")
    print("      STARTING CV WITH CONSISTENCY LOSS")
    print("=======================================================\n")

    for fold in folds:
        print(f"\n--- Running {fold['name']} (Held-out Engines: {fold['val_engines']}) ---")
        val_mask = np.isin(engine_ids, fold['val_engines'])
        train_mask = ~val_mask
        
        X_train, y_train = X[train_mask], y[train_mask]
        X_val, y_val = X[val_mask], y[val_mask]
        
        # Extract features for physics consistency (RPM, CPR, TER) from last cycle (index 4)
        rpm_train, cpr_train, ter_train = X_train[:, 4, 4], X_train[:, 4, 12], X_train[:, 4, 14]
        rpm_val, cpr_val, ter_val = X_val[:, 4, 4], X_val[:, 4, 12], X_val[:, 4, 14]
        
        y_train_extended = np.column_stack([y_train, engine_ids[train_mask], rpm_train, cpr_train, ter_train])
        y_val_extended = np.column_stack([y_val, engine_ids[val_mask], rpm_val, cpr_val, ter_val])
        
        y_val_unscaled = scaler_y.inverse_transform(y_val)
        
        ensemble_preds = []
        for seed in range(1, 6):
            print(f"  Training Seed {seed}/5...")
            tf.random.set_seed(seed)
            np.random.seed(seed)
            
            model = build_and_compile_model(use_physics_loss=True)
            early_stopping = EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True)
            
            history = model.fit(
                X_train, y_train_extended,
                validation_data=(X_val, y_val_extended),
                epochs=100,
                batch_size=16,
                shuffle=False,
                callbacks=[early_stopping],
                verbose=0
            )
            
            # Print separated losses for the final epoch of seed 1
            if seed == 1:
                final_data_loss = history.history['val_data_loss_metric'][-1]
                final_mono_loss = history.history['val_physics_loss_metric'][-1]
                final_cons_loss = history.history['val_consistency_loss_metric'][-1]
                print(f"    Validation Final Losses -> Data: {final_data_loss:.6f} | Monotonic: {final_mono_loss:.6f} | Consistency: {final_cons_loss:.6f}")
            
            if fold['name'] == 'Fold 1':
                model.save(f"turbojet_surrogate_seed{seed}.keras")
                if seed == 1:
                    model.save("turbojet_surrogate.keras")
                    
            y_pred = model.predict(X_val, verbose=0)
            y_pred_unscaled = scaler_y.inverse_transform(y_pred)
            ensemble_preds.append(y_pred_unscaled)
            
        ensemble_preds = np.array(ensemble_preds)
        y_pred_ensemble = np.mean(ensemble_preds, axis=0)
        
        metrics, phase_metrics = compute_fine_grained_metrics(y_val_unscaled, y_pred_ensemble, X_val, scaler_x)
        all_fold_metrics.append(metrics)
        all_phase_metrics.append(phase_metrics)
        
        print(f"\n{fold['name']} Results:")
        for target, mets in metrics.items():
            print(f"  {target:<12} | R2: {mets['R2']:7.4f} | RMSE: {mets['RMSE']:7.4f} | MAE: {mets['MAE']:7.4f}")

    print("\n=======================================================")
    print("      CROSS-VALIDATION RESULTS (MEAN ± STD ACROSS FOLDS)")
    print("=======================================================")
    
    targets = ['Compressor', 'Combustor', 'Turbine', 'Overall']
    print("\n1. Overall Generalization Performance (Held-out Engines):")
    print(f"{'Target':<12} | {'R2':<15} | {'RMSE':<15} | {'MAE':<15}")
    print("-" * 65)
    for target in targets:
        r2_vals = [f[target]['R2'] for f in all_fold_metrics]
        rmse_vals = [f[target]['RMSE'] for f in all_fold_metrics]
        mae_vals = [f[target]['MAE'] for f in all_fold_metrics]
        print(f"{target:<12} | {np.mean(r2_vals):.4f} ± {np.std(r2_vals):.4f} | "
              f"{np.mean(rmse_vals):.4f} ± {np.std(rmse_vals):.4f} | "
              f"{np.mean(mae_vals):.4f} ± {np.std(mae_vals):.4f}")

    print("=======================================================\n")
    joblib.dump(scaler_x, "scaler_x.joblib")
    joblib.dump(scaler_y, "scaler_y.joblib")

if __name__ == "__main__":
    os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
    train_model()
