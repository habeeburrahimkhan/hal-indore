import os
import json
import logging
# pyrefly: ignore [missing-import]
from groq import AsyncGroq

logger = logging.getLogger("diagnostic_ai")

# Read API Key securely from the environment
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# Default fallback generator if Groq fails or is not configured
def generate_rule_based_brief(telemetry: dict, predictions: dict) -> dict:
    """
    Generates a rule-based engineering diagnostic brief when the AI model is offline.
    """
    comp_h = predictions.get("compressor_health", 1.0)
    comb_h = predictions.get("combustor_health", 1.0)
    turb_h = predictions.get("turbine_health", 1.0)
    over_h = predictions.get("overall_health", 1.0)
    thrust = predictions.get("thrust", 0.0)
    rpm = telemetry.get("RPM_rev_min", 0.0)

    min_h = min(comp_h, comb_h, turb_h, over_h)

    # Determine severity based on the lowest health metric
    if min_h < 0.70:
        severity = "Critical"
    elif min_h < 0.85:
        severity = "Warning"
    elif min_h < 0.95:
        severity = "Advisory"
    else:
        severity = "Normal"

    issues = []
    recs = []

    if comp_h < 0.95:
        issues.append(f"compressor degradation ({comp_h:.2%})")
        recs.append("Inspect compressor blades for fouling or aerodynamic stall signs")
    if comb_h < 0.95:
        issues.append(f"combustor degradation ({comb_h:.2%})")
        recs.append("Check fuel nozzles and combustor casing for thermal stress")
    if turb_h < 0.95:
        issues.append(f"turbine degradation ({turb_h:.2%})")
        recs.append("Examine turbine guide vanes and check for high-temperature creep")

    if not issues:
        title = "Engine Operating Normally"
        summary = (
            f"All turbojet subsystems are operating within normal parameters. "
            f"Overall engine health is stable at {over_h:.2%}, producing {thrust:.1f} N of thrust "
            f"at {rpm:.0f} RPM."
        )
        recommendation = "Continue standard flight operations and routine scheduled telemetry monitoring."
    else:
        title = f"Engine Health Degradation - {severity} Alert"
        summary = (
            f"Subsystem analysis detects: {', '.join(issues)}. "
            f"Overall engine health is estimated at {over_h:.2%}. Thrust performance is at {thrust:.1f} N."
        )
        recommendation = f"Recommended actions: {'; '.join(recs)}."

    return {
        "severity": severity,
        "title": title,
        "summary": summary,
        "recommendation": recommendation
    }

async def generate_diagnostic_brief(telemetry: dict, predictions: dict) -> dict:
    """
    Asynchronously invokes the Groq API to generate an engineering diagnostic
    based on live telemetry values and LSTM health predictions. Falls back to a 
    rule-based generator if the API is offline.
    """
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY environment variable is not set. Returning dynamic rule-based diagnostic.")
        return generate_rule_based_brief(telemetry, predictions)

    # Construct the user prompt using available telemetry and predicted parameters
    prompt_content = f"""
    Current Operating Conditions (Last Cycle):
    - Altitude: {telemetry.get('Altitude_m', 'N/A')} m
    - Mach Number: {telemetry.get('Mach', 'N/A')}
    - Ambient Temperature (Tamb_K): {telemetry.get('Tamb_K', 'N/A')} K
    - Ambient Pressure (Pamb_Pa): {telemetry.get('Pamb_Pa', 'N/A')} Pa
    - Rotor Speed (RPM): {telemetry.get('RPM_rev_min', 'N/A')} rev/min
    - Fuel Flow: {telemetry.get('FuelFlow_kg_s', 'N/A')} kg/s
    - Compressor Inlet Pressure (P2): {telemetry.get('P2_Pa', 'N/A')} Pa
    - Compressor Inlet Temperature (T2): {telemetry.get('T2_K', 'N/A')} K
    - Combustor Inlet Pressure (P3): {telemetry.get('P3_Pa', 'N/A')} Pa
    - Combustor Inlet Temperature (T3): {telemetry.get('T3_K', 'N/A')} K
    - Turbine Inlet Pressure (P4): {telemetry.get('P4_Pa', 'N/A')} Pa
    - Turbine Inlet Temperature (T4): {telemetry.get('T4_K', 'N/A')} K

    Predicted Outputs (LSTM Surrogate Model):
    - Compressor Health: {predictions.get('compressor_health', 0.0):.4f} (1.0 = perfect health)
    - Combustor Health: {predictions.get('combustor_health', 0.0):.4f} (1.0 = perfect health)
    - Turbine Health: {predictions.get('turbine_health', 0.0):.4f} (1.0 = perfect health)
    - Overall Health: {predictions.get('overall_health', 0.0):.4f} (1.0 = perfect health)
    - Thrust: {predictions.get('thrust', 0.0):.2f} N
    - TSFC: {predictions.get('tsfc', 0.0):.4f} g/N/s
    """

    try:
        # Initialize the asynchronous Groq client
        client = AsyncGroq(api_key=GROQ_API_KEY)
        
        # Call the chat completions API
        chat_completion = await client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an aerospace engine diagnostic assistant specializing in turbojet predictive maintenance. "
                        "Analyze only the telemetry and prediction values provided. Do not invent additional sensor readings, "
                        "failure modes, probabilities, confidence scores, or maintenance history. Base every observation and "
                        "recommendation strictly on the supplied data. If all values indicate healthy operation, clearly state "
                        "that the engine is operating within expected parameters. Keep the response concise, technically accurate, "
                        "actionable, and professional. Return only valid JSON with no markdown or extra text.\n\n"
                        "You must output JSON in the following format:\n"
                        "{\n"
                        "  \"severity\": \"Normal | Advisory | Warning | Critical\",\n"
                        "  \"title\": \"Short engineering diagnosis\",\n"
                        "  \"summary\": \"2-3 sentence explanation of the engine condition based only on the provided telemetry.\",\n"
                        "  \"recommendation\": \"Specific corrective action or monitoring recommendation.\"\n"
                        "}"
                    )
                },
                {
                    "role": "user",
                    "content": prompt_content
                }
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            temperature=0.1,
            timeout=8.0  # Prevent stalling the main API request if Groq is slow
        )

        response_text = chat_completion.choices[0].message.content
        if not response_text:
            return generate_rule_based_brief(telemetry, predictions)

        data = json.loads(response_text)
        
        # Verify JSON schema matches user specifications
        required_keys = {"severity", "title", "summary", "recommendation"}
        if all(key in data for key in required_keys):
            return data
        else:
            logger.error(f"Groq response JSON is missing expected keys: {data}")
            return generate_rule_based_brief(telemetry, predictions)

    except Exception as e:
        logger.error(f"Failed to generate AI diagnostic brief: {e}")
        return generate_rule_based_brief(telemetry, predictions)

