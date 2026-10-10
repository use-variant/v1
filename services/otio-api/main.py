from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import opentimelineio as otio
import json

app = FastAPI(title="MaaS OTIO API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExportRequest(BaseModel):
    otio_manifest: str # The mathematically merged OTIO JSON string
    asset_ledger: dict # Key-value map linking clip names to their original local file paths

@app.post("/convert/fcpxml-to-json")
async def convert_fcpxml_to_json(file: UploadFile = File(...)):
    import time
    start_time = time.time()
    try:
        read_start = time.time()
        contents = await file.read()
        contents_str = contents.decode("utf-8")
        print(f"[PYTHON AUDIT] File read & decode took: {time.time() - read_start:.2f}s")
        
        # Parse FCPXML to OTIO Timeline
        parse_start = time.time()
        timeline = otio.adapters.read_from_string(contents_str, "fcpx_xml")
        print(f"[PYTHON AUDIT] OTIO FCPXML Parse took: {time.time() - parse_start:.2f}s")
        
        # Serialize OTIO Timeline to OTIO JSON string
        serialize_start = time.time()
        otio_json_str = otio.adapters.write_to_string(timeline, "otio_json")
        print(f"[PYTHON AUDIT] OTIO JSON Serialize took: {time.time() - serialize_start:.2f}s")
        
        # Return the JSON string (could be parsed into dict, but returning string as requested or parsing it so it's actual JSON)
        return json.loads(otio_json_str)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing FCPXML: {str(e)}")
    finally:
        print(f"[PYTHON AUDIT] Total Endpoint Time: {time.time() - start_time:.2f}s")

@app.post("/convert/json-to-fcpxml")
async def convert_json_to_fcpxml(payload: ExportRequest):
    try:
        # Parse OTIO JSON back to OTIO Timeline
        timeline = otio.adapters.read_from_string(payload.otio_manifest, "otio_json")
        
        # Re-linking Logic
        for clip in timeline.each_clip():
            if clip.name in payload.asset_ledger:
                original_path = payload.asset_ledger[clip.name]
                clip.media_reference = otio.schema.ExternalReference(target_url=original_path)
        
        # Serialize OTIO Timeline to FCPXML
        fcpxml_str = otio.adapters.write_to_string(timeline, "fcpx_xml")
        
        return {"fcpxml": fcpxml_str}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing OTIO JSON: {str(e)}")
