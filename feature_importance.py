import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
import numpy as np
import tensorflow as tf
from sklearn.metrics import mean_squared_error
from data_pipeline import preprocess_and_window_data

def run_permutation_importance():
    print("Loading data...")
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data('turbojet_complete_dataset.csv')
    
    # Fold 1 validation engines [1, 2, 3]
    val_mask = np.isin(engine_ids, [1, 2, 3])
    X_val, y_val = X[val_mask], y[val_mask]
    
    y_val_unscaled = scaler_y.inverse_transform(y_val)[:, :4]  # We check the 4 health outputs
    
    print("Loading ensemble models...")
    models = []
    for i in range(1, 6):
        path = f"turbojet_surrogate_seed{i}.keras"
        if os.path.exists(path):
            models.append(tf.keras.models.load_model(path, compile=False))
            
    if not models:
        print("Error: No seed models found. Please train surrogate model first.")
        return
        
    # Baseline prediction (unscaled)
    preds = []
    for m in models:
        raw_pred = m(X_val, training=False).numpy()
        preds.append(scaler_y.inverse_transform(raw_pred)[:, :4])
    y_pred_baseline = np.mean(preds, axis=0)
    
    # Calculate baseline MSE per health target
    targets = ['CompressorHealth', 'CombustorHealth', 'TurbineHealth', 'OverallHealth']
    baseline_mse = {}
    for i, target in enumerate(targets):
        baseline_mse[target] = mean_squared_error(y_val_unscaled[:, i], y_pred_baseline[:, i])
        
    feature_names = [
        'Altitude_m', 'Mach', 'Tamb_K', 'Pamb_Pa', 'RPM_rev_min', 'FuelFlow_kg_s',
        'P2_Pa', 'T2_K', 'P3_Pa', 'T3_K', 'P4_Pa', 'T4_K',
        'CPR', 'Combustor_Heat_Addition', 'TER'
    ]
    
    importance_results = {target: {} for target in targets}
    
    print("\nStarting permutation loop...")
    for f_idx, f_name in enumerate(feature_names):
        # Create a copy and permute the feature along the sample dimension
        X_val_permuted = X_val.copy()
        
        # Shuffle along axis 0 (samples)
        shuffled_indices = np.random.permutation(X_val.shape[0])
        X_val_permuted[:, :, f_idx] = X_val[shuffled_indices, :, f_idx]
        
        # Predict on permuted dataset
        perm_preds = []
        for m in models:
            raw_pred = m(X_val_permuted, training=False).numpy()
            perm_preds.append(scaler_y.inverse_transform(raw_pred)[:, :4])
        y_pred_perm = np.mean(perm_preds, axis=0)
        
        # Measure error increase
        for i, target in enumerate(targets):
            perm_mse = mean_squared_error(y_val_unscaled[:, i], y_pred_perm[:, i])
            importance = perm_mse - baseline_mse[target]
            importance_results[target][f_name] = max(0.0, importance)
            
    print("\n=======================================================")
    print("      PERMUTATION FEATURE IMPORTANCE RESULTS")
    print("=======================================================\n")
    
    for target in targets:
        print(f"Target: {target}")
        print(f"{'Feature':<25} | {'Importance (Delta MSE)':<20}")
        print("-" * 50)
        # Sort features by importance descending
        sorted_features = sorted(importance_results[target].items(), key=lambda x: x[1], reverse=True)
        for f_name, imp in sorted_features[:8]:  # Print top 8 features
            print(f"{f_name:<25} | {imp:.6f}")
        print("\n")

if __name__ == "__main__":
    run_permutation_importance()
