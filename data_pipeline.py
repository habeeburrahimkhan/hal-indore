import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler

def preprocess_and_window_data(file_path):
    print(f"Loading dataset from {file_path}...")
    df = pd.read_csv(file_path)
    
    # 1. Feature Engineering (Physics-Informed Features)
    print("Engineering physics-informed features...")
    df['CPR'] = df['P2_Pa'] / df['Pamb_Pa']
    df['Combustor_Heat_Addition'] = df['T3_K'] - df['T2_K']
    df['TER'] = df['P3_Pa'] / df['P4_Pa']
    
    # 2. Define features and targets
    target_cols = [
        'CompressorHealth', 'CombustorHealth', 'TurbineHealth', 
        'OverallHealth', 'Thrust_N', 'TSFC_g_N_s'
    ]
    
    # Exclude metadata (EngineID, Cycle) and targets to form feature list
    exclude_cols = ['EngineID', 'Cycle'] + target_cols
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    
    print(f"Features list ({len(feature_cols)}): {feature_cols}")
    print(f"Targets list ({len(target_cols)}): {target_cols}")
    
    # Sort chronologically by EngineID and then by Cycle
    df = df.sort_values(by=['EngineID', 'Cycle']).reset_index(drop=True)
    
    # 3. Normalization (MinMaxScaler)
    print("Normalizing features and targets...")
    scaler_x = MinMaxScaler()
    scaler_y = MinMaxScaler()
    
    df[feature_cols] = scaler_x.fit_transform(df[feature_cols])
    df[target_cols] = scaler_y.fit_transform(df[target_cols])
    
    # 4. Time-Series Sliding Windowing (window_size = 5)
    window_size = 5
    
    X_list = []
    y_list = []
    engine_ids_list = []
    
    grouped = df.groupby('EngineID')
    
    for engine_id, group in grouped:
        group_features = group[feature_cols].values
        group_targets = group[target_cols].values
        
        n_samples = len(group)
        if n_samples < window_size + 1:
            print(f"Skipping EngineID {engine_id} due to insufficient cycles ({n_samples})")
            continue
            
        for i in range(n_samples - window_size):
            window_x = group_features[i : i + window_size]
            target_y = group_targets[i + window_size]
            
            X_list.append(window_x)
            y_list.append(target_y)
            engine_ids_list.append(engine_id)
            
    X = np.array(X_list)
    y = np.array(y_list)
    engine_ids = np.array(engine_ids_list)
    
    # 5. Output validation
    print("\n--- Output Validation ---")
    print(f"X shape (samples, window_size, features): {X.shape}")
    print(f"y shape (samples, targets): {y.shape}")
    print(f"engine_ids shape: {engine_ids.shape}")
    
    return X, y, scaler_x, scaler_y, engine_ids

if __name__ == "__main__":
    X, y, scaler_x, scaler_y, engine_ids = preprocess_and_window_data("turbojet_complete_dataset.csv")
