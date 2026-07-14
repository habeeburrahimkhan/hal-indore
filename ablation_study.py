import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
import numpy as np
import tensorflow as tf
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error

from data_pipeline import preprocess_and_window_data
from train_surrogate_model import build_and_compile_model, compute_fine_grained_metrics

def train_ablation_variant(name, use_physics_loss, num_models):
    print(f"\n=============================================")
    print(f"Starting Variant: {name}")
    print(f"Physics Loss: {use_physics_loss} | Ensemble Size: {num_models}")
    print(f"=============================================")
    
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data('turbojet_complete_dataset.csv')
    
    folds = [
        {'name': 'Fold 1', 'val_engines': [1, 2, 3]},
        {'name': 'Fold 2', 'val_engines': [4, 5, 6]},
        {'name': 'Fold 3', 'val_engines': [7, 8, 9, 10]}
    ]
    
    all_fold_metrics = []
    
    for fold in folds:
        print(f"  Running {fold['name']}...")
        val_mask = np.isin(engine_ids, fold['val_engines'])
        train_mask = ~val_mask
        
        X_train, y_train = X[train_mask], y[train_mask]
        X_val, y_val = X[val_mask], y[val_mask]
        
        rpm_train, cpr_train, ter_train = X_train[:, 4, 4], X_train[:, 4, 12], X_train[:, 4, 14]
        rpm_val, cpr_val, ter_val = X_val[:, 4, 4], X_val[:, 4, 12], X_val[:, 4, 14]
        
        y_train_extended = np.column_stack([y_train, engine_ids[train_mask], rpm_train, cpr_train, ter_train])
        y_val_extended = np.column_stack([y_val, engine_ids[val_mask], rpm_val, cpr_val, ter_val])
        
        y_val_unscaled = scaler_y.inverse_transform(y_val)
        
        ensemble_preds = []
        for seed in range(1, num_models + 1):
            tf.keras.backend.clear_session()
            tf.random.set_seed(seed)
            np.random.seed(seed)
            
            model = build_and_compile_model(use_physics_loss=use_physics_loss)
            early_stopping = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
            
            y_train_target = y_train_extended if use_physics_loss else y_train
            y_val_target = y_val_extended if use_physics_loss else y_val
            
            model.fit(
                X_train, y_train_target,
                validation_data=(X_val, y_val_target),
                epochs=25,
                batch_size=16,
                shuffle=False,
                callbacks=[early_stopping],
                verbose=0
            )
            
            y_pred = model.predict(X_val, verbose=0)
            y_pred_unscaled = scaler_y.inverse_transform(y_pred[:, :6])
            ensemble_preds.append(y_pred_unscaled)
            
        ensemble_preds = np.array(ensemble_preds)
        y_pred_ensemble = np.mean(ensemble_preds, axis=0)
        
        metrics, _ = compute_fine_grained_metrics(y_val_unscaled, y_pred_ensemble, X_val, scaler_x)
        all_fold_metrics.append(metrics)
        
    targets = ['Compressor', 'Combustor', 'Turbine', 'Overall']
    results = {}
    for target in targets:
        r2 = np.mean([f[target]['R2'] for f in all_fold_metrics])
        rmse = np.mean([f[target]['RMSE'] for f in all_fold_metrics])
        mae = np.mean([f[target]['MAE'] for f in all_fold_metrics])
        results[target] = {'R2': r2, 'RMSE': rmse, 'MAE': mae}
        print(f"    {target:<12} | R2: {r2:.4f} | RMSE: {rmse:.4f} | MAE: {mae:.4f}")
        
    return results

print("\n--- ABLATION STUDY ---")
baseline = train_ablation_variant("1. Baseline", False, 1)
physics = train_ablation_variant("2. + Physics Only", True, 1)
ensemble = train_ablation_variant("3. + Ensemble Only", False, 5)
full = train_ablation_variant("4. Full Model", True, 5)

print("\n\n===========================================================================")
print("                      ABLATION STUDY FINAL RESULTS")
print("===========================================================================")
print(f"{'Variant':<20} | {'Compressor R2':<15} | {'Turbine R2':<15} | {'Overall R2':<15}")
print("-" * 75)
print(f"{'1. Baseline':<20} | {baseline['Compressor']['R2']:<15.4f} | {baseline['Turbine']['R2']:<15.4f} | {baseline['Overall']['R2']:<15.4f}")
print(f"{'2. Physics Only':<20} | {physics['Compressor']['R2']:<15.4f} | {physics['Turbine']['R2']:<15.4f} | {physics['Overall']['R2']:<15.4f}")
print(f"{'3. Ensemble Only':<20} | {ensemble['Compressor']['R2']:<15.4f} | {ensemble['Turbine']['R2']:<15.4f} | {ensemble['Overall']['R2']:<15.4f}")
print(f"{'4. Full Model':<20} | {full['Compressor']['R2']:<15.4f} | {full['Turbine']['R2']:<15.4f} | {full['Overall']['R2']:<15.4f}")
print("===========================================================================\n")
