// const RENDER_URL = 'http://localhost:4000/render';

// async function getResponse(body: string) {
// 	return await fetch(RENDER_URL, {
// 		method: 'POST',
// 		headers: {
// 			// eslint-disable-next-line @typescript-eslint/naming-convention
// 			'Content-Type': 'application/json',
// 		},
// 		body,
// 	});
// }

// export async function POST(request: Request) {
// 	const body = await request.json();

// 	const response = await getResponse(JSON.stringify(body));
// 	if (!response.ok) {
// 		return new Response('Failed to render', {status: 500});
// 	}

// 	return new Response(response.body, {status: 200});
// }

// import { NextRequest, NextResponse } from "next/server";
// import { callVideoGenerator } from "@/app/videoGenerator";
// // This handles POST requests to /api/generate-video
// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();
//     // Extract any required params from body, e.g., prompt or config
//     const someParam = body.someParam;

//     // Call your backend videoGenerator function (runs on server)
//     // const videoPath = await callVideoGenerator(someParam);

//     // Respond with the generated video path or URL
//     // return NextResponse.json({ videoPath });
// 	return "";
//   } catch (error: any) {
//     // Handle errors
//     return NextResponse.json({ error: error.message || "Error generating video" }, { status: 500 });
//   }
// }


// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { callVideoGenerator } from "../../videoGenerator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate and extract parameters
    const {
      script,
      preferences,
      contentClass,
      user_video_id,
      modelName,
      rebuild = false
    } = body;

    // Basic type validation for required fields
    if (
      typeof script !== "string" ||
      typeof preferences !== "object" ||
      typeof contentClass !== "string" ||
      typeof user_video_id !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid parameters" },
        { status: 400 }
      );
    }

    preferences.style = "slideshow";

    // Set up Streaming Response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          console.log("Starting video generation with streaming...");

          await callVideoGenerator(
            script,
            preferences,
            contentClass,
            user_video_id,
            "eleven", // default flow
            rebuild,    // use rebuild flag from request
            (progress: number, status: string) => {
              // On Progress Callback
              sendEvent({ type: "progress", progress, status });
            },
            modelName || "gemini-2.0-flash-lite"
          ).then((videoUrl) => {
            // On Success
            sendEvent({ type: "result", videoUrl });
            controller.close();
          });

        } catch (error: any) {
          console.error("Error in generate-video stream:", error);
          sendEvent({ type: "error", message: error.message || "Internal Server Error" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });

  } catch (error: any) {
    console.error("Error in generate-video API:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
