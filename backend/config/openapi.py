from fastapi.openapi.utils import get_openapi

def custom_openapi(app):
    """
    Custom OpenAPI schema generator to include validation error response.
    """
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="TextbookAI API",
        version="1.0.0",
        description="API for TextbookAI",
        routes=app.routes,
    )
    # Ensure components exist
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    if "schemas" not in openapi_schema["components"]:
        openapi_schema["components"]["schemas"] = {}
    
    # Remove the default ValidationError schema
    if "ValidationError" in openapi_schema["components"]["schemas"]:
        del openapi_schema["components"]["schemas"]["ValidationError"]
    
    # Override all 422 responses in paths to use custom schema
    if "paths" in openapi_schema:
        for path in openapi_schema["paths"].values():
            for operation in path.values():
                if isinstance(operation, dict) and "responses" in operation:
                    if "422" in operation["responses"]:
                        operation["responses"]["422"] = {
                            "description": "Validation Error",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "detail": {"type": "string"}
                                        }
                                    }
                                }
                            },
                        }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema
