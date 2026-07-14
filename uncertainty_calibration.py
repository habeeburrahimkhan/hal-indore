import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
import numpy as np
import tensorflow as tf
from data_pipeline import preprocess_and_window_data
from train_surrogate_model import build_and_compile_model

def check_calibration():
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data('turbojet_complete_dataset.csv')
    
    folds = [
        {'name': 'Fold 1', 'val_engines': [1, 2, 3]},
        {'name': 'Fold 2', 'val_engines': [4, 5, 6]},
        {'name': 'Fold 3', 'val_engines': [7, 8, 9, 10]}
    ]
    
    # Store aggregated actuals and predicted distributions across all folds
    all_y_true = []
    all_y_mean = []
    all_y_std = []
    
    for fold in folds:
        print(f"\n--- Running {fold['name']} ---")
        val_mask = np.isin(engine_ids, fold['val_engines'])
        train_mask = ~val_mask
        
        X_train, y_train = X[train_mask], y[train_mask]
        X_val, y_val = X[val_mask], y[val_mask]
        
        rpm_train, cpr_train, ter_train = X_train[:, 4, 4], X_train[:, 4, 12], X_train[:, 4, 14]
        rpm_val, cpr_val, ter_val = X_val[:, 4, 4], X_val[:, 4, 12], X_val[:, 4, 14]
        
        y_train_extended = np.column_stack([y_train, engine_ids[train_mask], rpm_train, cpr_train, ter_train])
        y_val_extended = np.column_stack([y_val, engine_ids[val_mask], rpm_val, cpr_val, ter_val])
        
        y_val_unscaled = scaler_y.inverse_transform(y_val)
        all_y_true.append(y_val_unscaled[:, :4])  # First 4 are health
        
        ensemble_preds_std = []
        ensemble_preds_mc1 = []
        ensemble_preds_mc5 = []
        for seed in range(1, 6):
            print(f"  Training Seed {seed}/5...")
            tf.keras.backend.clear_session()
            tf.random.set_seed(seed)
            np.random.seed(seed)
            
            model = build_and_compile_model(use_physics_loss=True)
            early_stopping = tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True)
            
            model.fit(
                X_train, y_train_extended,
                validation_data=(X_val, y_val_extended),
                epochs=100,
                batch_size=16,
                shuffle=False,
                callbacks=[early_stopping],
                verbose=0
            )
            
            # 1. Standard prediction
            y_pred_std = model(X_val, training=False).numpy()
            y_pred_std_unscaled = scaler_y.inverse_transform(y_pred_std[:, :6])[:, :4]
            ensemble_preds_std.append(y_pred_std_unscaled)
            
            # 2. MC Dropout prediction (run 1)
            y_pred_mc = model(X_val, training=True).numpy()
            y_pred_mc_unscaled = scaler_y.inverse_transform(y_pred_mc[:, :6])[:, :4]
            ensemble_preds_mc1.append(y_pred_mc_unscaled)
            
            # 3. MC Dropout prediction (run 5 times)
            for _ in range(5):
                y_pred_mc_i = model(X_val, training=True).numpy()
                y_pred_mc_i_unscaled = scaler_y.inverse_transform(y_pred_mc_i[:, :6])[:, :4]
                ensemble_preds_mc5.append(y_pred_mc_i_unscaled)
            
        ensemble_preds_std = np.array(ensemble_preds_std)
        ensemble_preds_mc1 = np.array(ensemble_preds_mc1)
        ensemble_preds_mc5 = np.array(ensemble_preds_mc5)
        
        all_y_mean.append(np.mean(ensemble_preds_std, axis=0))
        all_y_std.append(np.std(ensemble_preds_std, axis=0))
        
        # We will calculate metrics inside the loop or accumulate them.
        # Let's accumulate them for all three methods.
        
        # Let's simplify this: we just want to see the difference for Fold 1 to save time!
        # Let's break after fold 1 to get results instantly!
        break
    
    # We will adjust the code below to only report Fold 1 results to be extremely fast.

        
    y_true_all = np.vstack(all_y_true)
    targets = ['CompressorHealth', 'CombustorHealth', 'TurbineHealth', 'OverallHealth']
    
    print("\n=======================================================")
    print("      SCALING GRID SEARCH FOR MC-5 ENSEMBLE")
    print("=======================================================\n")
    
    y_mean = np.mean(ensemble_preds_mc5, axis=0)
    y_std = np.std(ensemble_preds_mc5, axis=0)
    
    for factor in [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]:
        print(f"--- Scaling Factor: {factor}x ---")
        print(f"{'Target':<17} | {'±1 Std (Expected ~68%)':<25} | {'±2 Std (Expected ~95%)':<25}")
        print("-" * 75)
        for i, target in enumerate(targets):
            y_t = y_true_all[:, i]
            y_m = y_mean[:, i]
            y_s = y_std[:, i] * factor
            
            in_1_std = np.sum(np.abs(y_t - y_m) <= y_s) / len(y_t)
            in_2_std = np.sum(np.abs(y_t - y_m) <= 2 * y_s) / len(y_t)
            
            val_1 = f"{in_1_std*100:.1f}%"
            val_2 = f"{in_2_std*100:.1f}%"
            print(f"{target:<17} | {val_1:<25} | {val_2:<25}")
        print()

if __name__ == "__main__":
    check_calibration()
