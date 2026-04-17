#!/usr/bin/env python
# Startup script for Writer API
import sys
sys.path.insert(0, 'D:/writer/src')

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False
    )
