import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
import numpy as np
import tensorflow as tf
from sklearn.metrics import mean_squared_error, mean_absolute_error
from data_pipeline import preprocess_and_window_data

def evaluate_forecast():
    print("Loading data...")
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data('turbojet_complete_dataset.csv')
    
    # Validation engines across folds
    val_engines = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    
    # Load ensemble models
    print("Loading ensemble models...")
    models = []
    for i in range(1, 6):
        path = f"turbojet_surrogate_seed{i}.keras"
        if os.path.exists(path):
            models.append(tf.keras.models.load_model(path, compile=False))
            
    if not models:
        print("Error: No ensemble models found. Please train surrogate model first.")
        return
        
    targets = ['CompressorHealth', 'CombustorHealth', 'TurbineHealth', 'OverallHealth']
    
    # We will accumulate errors for N+5 and N+10 forecasts
    errors_5 = {target: [] for target in targets}
    errors_10 = {target: [] for target in targets}
    
    print("\nEvaluating forecasting trajectory per engine...")
    for eng_id in val_engines:
        # Get samples for this engine in chronological order
        eng_mask = (engine_ids == eng_id)
        X_eng = X[eng_mask]
        y_eng = y[eng_mask]
        
        if len(y_eng) < 15:
            continue
            
        y_eng_unscaled = scaler_y.inverse_transform(y_eng)[:, :4]  # health labels
        
        # Get predictions for all cycles using ensemble
        preds_all = []
        for m in models:
            preds_all.append(scaler_y.inverse_transform(m(X_eng, training=False).numpy())[:, :4])
        y_pred_all = np.mean(preds_all, axis=0) # shape: (cycles, 4)
        
        num_cycles = len(y_pred_all)
        
        # We start forecasting from cycle N = 8 up to N = num_cycles - 11
        for N in range(8, num_cycles - 10):
            # Past predictions up to N
            past_cycles = np.arange(1, N + 1)
            
            for t_idx, target in enumerate(targets):
                past_y = y_pred_all[:N, t_idx]
                
                # Fit linear regression: y = slope * x + intercept
                slope, intercept = np.polyfit(past_cycles, past_y, 1)
                
                # Extrapolate for N+5 and N+10
                pred_5 = slope * (N + 5) + intercept
                pred_10 = slope * (N + 10) + intercept
                
                # Bound between 0 and 1
                pred_5 = np.clip(pred_5, 0.0, 1.0)
                pred_10 = np.clip(pred_10, 0.0, 1.0)
                
                # True future values
                true_5 = y_eng_unscaled[N + 4, t_idx]  # N is 1-indexed for matching cycles, 0-indexed in array
                true_10 = y_eng_unscaled[N + 9, t_idx]
                
                errors_5[target].append((true_5, pred_5))
                errors_10[target].append((true_10, pred_10))
                
    print("\n=======================================================")
    print("      DEGRADATION TRAJECTORY FORECAST RESULTS")
    print("=======================================================\n")
    
    for horizon, error_dict in [("N+5 Cycles", errors_5), ("N+10 Cycles", errors_10)]:
        print(f"--- Horizon: {horizon} ---")
        print(f"{'Subsystem':<18} | {'RMSE':<10} | {'MAE':<10}")
        print("-" * 45)
        for target in targets:
            pairs = error_dict[target]
            trues = np.array([p[0] for p in pairs])
            preds = np.array([p[1] for p in pairs])
            
            rmse = np.sqrt(mean_squared_error(trues, preds))
            mae = mean_absolute_error(trues, preds)
            
            print(f"{target:<18} | {rmse:.4f}     | {mae:.4f}")
        print()

if __name__ == "__main__":
    evaluate_forecast()
