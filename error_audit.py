import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
import numpy as np
import tensorflow as tf
from data_pipeline import preprocess_and_window_data
from train_surrogate_model import build_and_compile_model

def audit_errors():
    print("Loading dataset...")
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data('turbojet_complete_dataset.csv')
    
    folds = [
        {'name': 'Fold 1', 'val_engines': [1, 2, 3]},
        {'name': 'Fold 2', 'val_engines': [4, 5, 6]},
        {'name': 'Fold 3', 'val_engines': [7, 8, 9, 10]}
    ]
    
    # Store global list of records: each record is (engine_id, cycle, actuals, preds, raw_sensors)
    records = []
    
    # We will reconstruct raw sensor values using scaler_x
    # X shape: (samples, 5, 15)
    samples = X.shape[0]
    X_flat = X.reshape(-1, 15)
    X_unscaled_flat = scaler_x.inverse_transform(X_flat)
    X_unscaled = X_unscaled_flat.reshape(samples, 5, 15)
    
    # In data_pipeline.py, the windowing keeps the original indices.
    # Let's count cycles per engine to figure out the cycle number of each window.
    # A cycle number for window i is the cycle index of its last timestep (index 4).
    # Since each engine sequence starts at cycle 1, let's track the cycle index manually.
    cycle_numbers = np.zeros(samples, dtype=int)
    for eng_id in range(1, 11):
        eng_mask = (engine_ids == eng_id)
        count = np.sum(eng_mask)
        # The cycles are sequential: 5, 6, 7 ... 5 + count - 1
        cycle_numbers[eng_mask] = np.arange(5, 5 + count)
        
    for fold in folds:
        print(f"\n--- Running evaluation on {fold['name']} ---")
        val_mask = np.isin(engine_ids, fold['val_engines'])
        train_mask = ~val_mask
        
        X_train, y_train = X[train_mask], y[train_mask]
        X_val, y_val = X[val_mask], y[val_mask]
        
        rpm_train, cpr_train, ter_train = X_train[:, 4, 4], X_train[:, 4, 12], X_train[:, 4, 14]
        rpm_val, cpr_val, ter_val = X_val[:, 4, 4], X_val[:, 4, 12], X_val[:, 4, 14]
        
        y_train_extended = np.column_stack([y_train, engine_ids[train_mask], rpm_train, cpr_train, ter_train])
        y_val_extended = np.column_stack([y_val, engine_ids[val_mask], rpm_val, cpr_val, ter_val])
        
        y_val_unscaled = scaler_y.inverse_transform(y_val)[:, :4]
        
        # Load or train ensemble models to get validation predictions
        # To make it fast, we train a single seed per fold for this error analysis
        # (A single model represents the predictive errors of the architecture accurately)
        tf.keras.backend.clear_session()
        tf.random.set_seed(42)
        np.random.seed(42)
        
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
        
        y_pred = model.predict(X_val, verbose=0)
        y_pred_unscaled = scaler_y.inverse_transform(y_pred)[:, :4]
        
        # Extract metadata and unscaled sensors for validation samples
        val_indices = np.where(val_mask)[0]
        for i, val_idx in enumerate(val_indices):
            # last timestep features (index 4) represent the current state
            raw_sensors = X_unscaled[val_idx, 4, :12]
            records.append({
                'engine_id': engine_ids[val_idx],
                'cycle': cycle_numbers[val_idx],
                'actuals': y_val_unscaled[i],
                'preds': y_pred_unscaled[i],
                'raw_sensors': raw_sensors
            })
            
    targets = ['CompressorHealth', 'CombustorHealth', 'TurbineHealth', 'OverallHealth']
    
    print("\n=======================================================")
    # Find top 3 worst predictions per target
    # Also evaluate error clustering (e.g. correlation between cycle number and absolute error)
    all_cycles = np.array([r['cycle'] for r in records])
    all_altitudes = np.array([r['raw_sensors'][0] for r in records])
    
    for t_idx, target in enumerate(targets):
        errors = []
        for r in records:
            err = np.abs(r['actuals'][t_idx] - r['preds'][t_idx])
            errors.append(err)
        errors = np.array(errors)
        
        # Analyze error correlation with cycle number (age) and altitude (flight phase)
        corr_cycle = np.corrcoef(all_cycles, errors)[0, 1]
        corr_alt = np.corrcoef(all_altitudes, errors)[0, 1]
        
        print(f"=== Worst Case Audit for {target} ===")
        print(f"Correlation of Error with Cycle (Age): {corr_cycle:.3f}")
        print(f"Correlation of Error with Altitude (Phase): {corr_alt:.3f}")
        
        worst_indices = np.argsort(errors)[::-1][:3]
        for rank, idx in enumerate(worst_indices):
            r = records[idx]
            err = errors[idx]
            alt = r['raw_sensors'][0]
            mach = r['raw_sensors'][1]
            phase = "Cruise" if alt >= 3000 else "Takeoff/Ground"
            
            print(f"  Rank {rank+1} Error: {err:.4f} (Actual: {r['actuals'][t_idx]:.4f}, Pred: {r['preds'][t_idx]:.4f})")
            print(f"    Engine: {r['engine_id']}, Cycle: {r['cycle']}, Phase: {phase} (Alt: {alt:.0f}m, Mach: {mach:.2f})")
            print(f"    Raw Sensors: FF={r['raw_sensors'][5]:.3f} kg/s, RPM={r['raw_sensors'][4]:.0f}, T4={r['raw_sensors'][11]:.1f} K, P3={r['raw_sensors'][8]/1000:.1f} kPa")
        print("-" * 50)

if __name__ == "__main__":
    audit_errors()
