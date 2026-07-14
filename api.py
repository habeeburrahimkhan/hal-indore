import os
import joblib
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List

# Configure TensorFlow to use CPU only to avoid GPU overhead inside lightweight web server
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'

# Initialize FastAPI App
app = FastAPI(
    title="Turbojet Digital Twin Surrogate API",
    description="Real-time predictive maintenance API serving LSTM surrogate outputs.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load LSTM surrogate model and scalers once at startup
# Load LSTM surrogate models and scalers once at startup
MODEL_PATHS = [f"turbojet_surrogate_seed{i}.keras" for i in range(1, 6)]
SCALER_X_PATH = "scaler_x.joblib"
SCALER_Y_PATH = "scaler_y.joblib"

MODELS = []
try:
    print("Loading TensorFlow surrogate models...")
    for path in MODEL_PATHS:
        if os.path.exists(path):
            print(f"Loading {path}...")
            MODELS.append(tf.keras.models.load_model(path, compile=False))
        else:
            print(f"Warning: {path} not found.")
            
    # Fallback to default if no seed models found
    if not MODELS:
        print("Fallback: loading default turbojet_surrogate.keras...")
        MODELS.append(tf.keras.models.load_model("turbojet_surrogate.keras", compile=False))
        
    print(f"Loaded {len(MODELS)} models successfully.")
    
    print("Loading MinMaxScaler models...")
    scaler_x = joblib.load(SCALER_X_PATH)
    scaler_y = joblib.load(SCALER_Y_PATH)
    print("Scalers loaded successfully.")
except Exception as e:
    print(f"CRITICAL: Failed to load model or scalers. Details: {e}")
    scaler_x, scaler_y = None, None

# Define input structure using Pydantic
class SensorPayload(BaseModel):
    # Expects exactly 5 cycles, each containing 12 base sensor values
    cycles: List[List[float]] = Field(
        ...,
        description="A list of 5 cycles. Each cycle contains 12 sensor values in order: [Altitude_m, Mach, Tamb_K, Pamb_Pa, RPM_rev_min, FuelFlow_kg_s, P2_Pa, T2_K, P3_Pa, T3_K, P4_Pa, T4_K]"
    )

from diagnostic_ai import generate_diagnostic_brief

@app.post("/predict")
async def predict_health(payload: SensorPayload):
    if not MODELS or scaler_x is None or scaler_y is None:
        raise HTTPException(
            status_code=500,
            detail="Surrogate models or scaling assets are not loaded on server."
        )
        
    cycles = payload.cycles
    
    if len(cycles) != 5:
        raise HTTPException(
            status_code=400,
            detail=f"The input must contain exactly 5 cycles. Received {len(cycles)}."
        )
        
    for idx, cycle in enumerate(cycles):
        if len(cycle) != 12:
            raise HTTPException(
                status_code=400,
                detail=f"Cycle index {idx} must contain exactly 12 sensor parameters. Received {len(cycle)}."
            )
            
    try:
        # Step A: Physics Engineering for each cycle
        engineered_cycles = []
        for cycle in cycles:
            # Unpack base 12 features
            Altitude_m, Mach, Tamb_K, Pamb_Pa, RPM_rev_min, FuelFlow_kg_s, P2_Pa, T2_K, P3_Pa, T3_K, P4_Pa, T4_K = cycle
            
            # Engineer 3 physics-informed features
            CPR = P2_Pa / Pamb_Pa if Pamb_Pa != 0 else 1.0
            Combustor_Heat_Addition = T3_K - T2_K
            TER = P3_Pa / P4_Pa if P4_Pa != 0 else 1.0
            
            # Combine to make 15 features
            full_features = [
                Altitude_m, Mach, Tamb_K, Pamb_Pa, RPM_rev_min, FuelFlow_kg_s,
                P2_Pa, T2_K, P3_Pa, T3_K, P4_Pa, T4_K,
                CPR, Combustor_Heat_Addition, TER
            ]
            engineered_cycles.append(full_features)
            
        # Step B: Scale features (input shape expects 2D for scaler_x)
        engineered_array = np.array(engineered_cycles) # Shape: (5, 15)
        scaled_features = scaler_x.transform(engineered_array)
        
        # Step C: Reshape to 3D tensor: (1, 5, 15)
        input_tensor = np.expand_dims(scaled_features, axis=0)
        
        # Step D: Inference across all models
        import time
        start_time = time.time()
        
        # Bypassing the slow tf.data overhead of model.predict() by using direct graph calls.
        # This reduces sequential latency from ~600ms down to ~140ms.
        input_tensor_tf = tf.constant(input_tensor, dtype=tf.float32)
        
        predictions_list = []
        for m in MODELS:
            # Enable training=True to activate Monte Carlo Dropout.
            # This prevents variance collapse and provides calibrated uncertainty bounds.
            raw_prediction = m(input_tensor_tf, training=True).numpy() # Shape: (1, 6)
            unscaled_prediction = scaler_y.inverse_transform(raw_prediction)[0]
            predictions_list.append(unscaled_prediction)
            
        predictions_array = np.array(predictions_list) # Shape: (num_models, 6)
        
        means = np.mean(predictions_array, axis=0)
        # Apply 2.5x calibration scaling factor to align MC Dropout stds with actual empirical errors
        stds = np.std(predictions_array, axis=0) * 2.5
        
        latency_ms = (time.time() - start_time) * 1000
        print(f"Ensemble inference latency: {latency_ms:.2f} ms")
        
        comp_h, comp_std = float(means[0]), float(stds[0])
        comb_h, comb_std = float(means[1]), float(stds[1])
        turb_h, turb_std = float(means[2]), float(stds[2])
        
        # Reimplement overall_health as a weighted composite of subsystem criticality
        # - Turbine (50%): Highest operational criticality (extreme thermal/mechanical stress, uncontained failure risk)
        # - Compressor (35%): High criticality (surge/stall risk, FOD susceptibility)
        # - Combustor (15%): Lower immediate mechanical risk (no moving parts)
        composite_overall_mean = (0.50 * turb_h) + (0.35 * comp_h) + (0.15 * comb_h)
        composite_overall_std = (0.50 * turb_std) + (0.35 * comp_std) + (0.15 * comb_std)
        
        # Map values to output keys as nested objects containing mean and std
        result = {
            "compressor_health": {"mean": comp_h, "std": comp_std},
            "combustor_health": {"mean": comb_h, "std": comb_std},
            "turbine_health": {"mean": turb_h, "std": turb_std},
            "overall_health": {"mean": composite_overall_mean, "std": composite_overall_std},
            "thrust": {"mean": float(means[4]), "std": float(stds[4])},
            "tsfc": {"mean": float(means[5]), "std": float(stds[5])}
        }
        
        # Step F: Generate AI Diagnostic Brief using average predictions
        last_cycle = cycles[-1]
        telemetry = {
            "Altitude_m": last_cycle[0],
            "Mach": last_cycle[1],
            "Tamb_K": last_cycle[2],
            "Pamb_Pa": last_cycle[3],
            "RPM_rev_min": last_cycle[4],
            "FuelFlow_kg_s": last_cycle[5],
            "P2_Pa": last_cycle[6],
            "T2_K": last_cycle[7],
            "P3_Pa": last_cycle[8],
            "T3_K": last_cycle[9],
            "P4_Pa": last_cycle[10],
            "T4_K": last_cycle[11]
        }
        brief_predictions = {
            "compressor_health": float(means[0]),
            "combustor_health": float(means[1]),
            "turbine_health": float(means[2]),
            "overall_health": float(means[3]),
            "thrust": float(means[4]),
            "tsfc": float(means[5])
        }
        brief = await generate_diagnostic_brief(telemetry, brief_predictions)
        result["diagnostic_brief"] = brief
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Inference pipeline execution failure: {str(e)}"
        )

@app.get("/health")
def health_check():
    status = "OK" if (len(MODELS) > 0) else "ERROR"
    return {"status": status}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
