import os
import joblib
import numpy as np
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge

from data_pipeline import preprocess_and_window_data

def evaluate_baselines():
    # Load and preprocess data exactly as in the LSTM setup
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data('turbojet_complete_dataset.csv')
    
    # Flatten the window dimension for standard sklearn regressors
    # X shape: (samples, 5, 15) -> (samples, 75)
    samples, window_size, features = X.shape
    X_flat = X.reshape(samples, window_size * features)
    
    folds = [
        {'name': 'Fold 1', 'val_engines': [1, 2, 3]},
        {'name': 'Fold 2', 'val_engines': [4, 5, 6]},
        {'name': 'Fold 3', 'val_engines': [7, 8, 9, 10]}
    ]
    
    models = {
        'Linear Regression (Ridge)': Ridge(alpha=1.0),
        'Random Forest (100 trees)': RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    }
    
    results = {model_name: [] for model_name in models.keys()}
    
    for fold in folds:
        print(f"\n--- Running {fold['name']} ---")
        val_mask = np.isin(engine_ids, fold['val_engines'])
        train_mask = ~val_mask
        
        X_train, y_train = X_flat[train_mask], y[train_mask]
        X_val, y_val = X_flat[val_mask], y[val_mask]
        
        y_val_unscaled = scaler_y.inverse_transform(y_val)
        
        for model_name, model in models.items():
            print(f"  Training {model_name}...")
            # We only train on the first 6 targets (4 health outputs + 2 performance outputs)
            # which matches what y contains
            model.fit(X_train, y_train)
            y_pred = model.predict(X_val)
            y_pred_unscaled = scaler_y.inverse_transform(y_pred)
            
            # Compute metrics for the 4 health targets
            targets = ['CompressorHealth', 'CombustorHealth', 'TurbineHealth', 'OverallHealth']
            metrics = {}
            for i in range(4):
                mse = mean_squared_error(y_val_unscaled[:, i], y_pred_unscaled[:, i])
                metrics[targets[i]] = {
                    'RMSE': np.sqrt(mse),
                    'MAE': mean_absolute_error(y_val_unscaled[:, i], y_pred_unscaled[:, i]),
                    'R2': r2_score(y_val_unscaled[:, i], y_pred_unscaled[:, i])
                }
            results[model_name].append(metrics)

    print("\n=======================================================")
    print("      BASELINE EVALUATION RESULTS (MEAN ACROSS FOLDS)")
    print("=======================================================\n")
    
    targets = ['CompressorHealth', 'CombustorHealth', 'TurbineHealth', 'OverallHealth']
    
    for model_name, fold_metrics in results.items():
        print(f"Model: {model_name}")
        print(f"{'Target':<17} | {'R2':<10} | {'RMSE':<10} | {'MAE':<10}")
        print("-" * 55)
        for target in targets:
            r2 = np.mean([f[target]['R2'] for f in fold_metrics])
            rmse = np.mean([f[target]['RMSE'] for f in fold_metrics])
            mae = np.mean([f[target]['MAE'] for f in fold_metrics])
            print(f"{target:<17} | {r2:7.4f}    | {rmse:7.4f}    | {mae:7.4f}")
        print("\n")

if __name__ == "__main__":
    evaluate_baselines()
