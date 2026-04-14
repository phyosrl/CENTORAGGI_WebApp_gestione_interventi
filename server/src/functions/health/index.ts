import { app, HttpRequest, HttpResponseInit } from "@azure/functions";

export async function health(request: HttpRequest): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: "ok",
      message: "API is running"
    }
  };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: health
});
