export function templateSelector(chunk:string, keywords:string,tag:string,script_context_summary:string) {
    // llm selecting template based on chunk, keywords, tag and script context summary
    // For now, we will return a hardcoded template
    let templateData = {
        "slideshow": {
  type: "object",
  properties: {
    subtype: {
      type: "string",
      enum: [
        "realistic",
        "icon_illustration",
        "stock_video",
        "animation"
      ],
      description: "The type of media content"
    },
    generated: {
      type: "boolean",
      description: "Whether the media is generated (true/false)"
    },
    media_query: {
      type: "string",
      description: "The media query string"
    },
    start_time: {
      type: "number",
      description: "Start time in seconds"
    },
    end_time: {
      type: "number",
      description: "End time in seconds"
    }
  },
  required: [
    "subtype",
    "generated",
    "media_query",
    "start_time",
    "end_time"
  ]
}
    }

    return templateData["slideshow"];
}

// Define the SceneJson type if not already defined or import it from the correct module
// type templateJson = Array<{
//     type: string; 
//     tag: string;
//     background_type: enums["color"|"image"|"video"];
//     subtype: string;
//     imagePath: string;
//     videoPath: string;
//     duration: number;
//     style: {
//         fontSize: string;
//         fontWeight: string;
//         color: string;
//     };
// }>;

// export function collectTemplateAssets(template: any, keywords: string[]): templateJson {
//     if(template=="slideshow") {
//         return {
//             type: string,
//             tag:string,
//             media_query
//         }
//     }
//     // This function should return a SceneJson object based on the template and keywords
//     // For now, we will return a dummy object
//     return [
//         {
//             audioPath: "",
//             text: keywords.join(" "),
//             imagePath: "",
//             videoPath: "",
//             duration: 5,
//             style: {
//                 fontSize: "48px",
//                 fontWeight: "bold",
//                 color: "#FFFFFF"
//             }
//         }
//     ];
// }