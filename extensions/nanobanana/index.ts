/**
 * Nano Banana - pi Extension
 * 
 * Port of nanobanana (Gemini CLI extension) for image generation
 * using Google Gemini image models via pi's extension system.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ============================================
// CONSTANTS
// ============================================

const IMAGE_STYLES = [
  "photorealistic", "watercolor", "oil-painting", "sketch", 
  "pixel-art", "anime", "vintage", "modern", "abstract", "minimalist"
] as const;

const VARIATION_TYPES = [
  "lighting", "angle", "color-palette", "composition", 
  "mood", "season", "time-of-day"
] as const;

const ASPECT_RATIOS = [
  "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
] as const;

const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Search paths for finding input images
const SEARCH_PATHS = [
  process.cwd(),
  join(process.cwd(), "images"),
  join(process.cwd(), "input"),
  join(process.cwd(), "nanobanana-output"),
  join(process.env.HOME || "~", "Downloads"),
  join(process.env.HOME || "~", "Desktop"),
];

// ============================================
// FILE HANDLING
// ============================================

function ensureOutputDirectory(): string {
  const outputPath = join(process.cwd(), "nanobanana-output");
  mkdir(outputPath, { recursive: true });
  return outputPath;
}

function findInputFile(filename: string): { found: boolean; filePath?: string } {
  // Check if absolute path exists
  if (isAbsolute(filename) && existsSync(filename)) {
    return { found: true, filePath: filename };
  }

  // Search in common paths
  for (const searchPath of SEARCH_PATHS) {
    const fullPath = join(searchPath, filename);
    if (existsSync(fullPath)) {
      return { found: true, filePath: fullPath };
    }
  }

  return { found: false };
}

/**
 * Generate filename from prompt - matches original nanobanana logic
 */
function generateFilename(
  prompt: string,
  format: "png" | "jpeg" = "png",
  index: number = 0,
  existingFiles?: string[]
): string {
  // Clean prompt for filename
  let baseName = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 32);

  if (!baseName) {
    baseName = "generated_image";
  }

  const extension = format === "jpeg" ? "jpg" : "png";
  let fileName = index > 0 ? `${baseName}_${index}.${extension}` : `${baseName}.${extension}`;

  // Avoid overwriting existing files
  if (existingFiles && existingFiles.includes(fileName)) {
    let counter = 1;
    while (existingFiles.includes(`${baseName}_${counter}.${extension}`)) {
      counter++;
    }
    fileName = `${baseName}_${counter}.${extension}`;
  }

  return fileName;
}

async function saveImage(base64Data: string, filename: string): Promise<string> {
  const outputPath = ensureOutputDirectory();
  const buffer = Buffer.from(base64Data, "base64");
  const filepath = join(outputPath, filename);
  await writeFile(filepath, buffer);
  return filepath;
}

async function readImageAsBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return buffer.toString("base64");
}

// ============================================
// GEMINI API
// ============================================

async function generateImage(
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
    }),
    signal
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }
  }

  throw new Error("No image in Gemini response");
}

async function generateImageWithImage(
  apiKey: string,
  model: string,
  prompt: string,
  imageBase64: string,
  mimeType: string = "image/png",
  signal?: AbortSignal
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
    }),
    signal
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }
  }

  throw new Error("No image in Gemini response");
}

// ============================================
// BUILD PROMPTS
// ============================================

function buildVariationsPrompt(basePrompt: string, styles?: string[], variations?: string[]): string[] {
  const prompts: string[] = [];
  
  if (styles?.length) {
    for (const style of styles) {
      prompts.push(`${basePrompt}, ${style} style`);
    }
  }
  
  if (variations?.length) {
    const basePrompts = prompts.length > 0 ? prompts : [basePrompt];
    for (const baseP of basePrompts) {
      for (const variation of variations) {
        switch (variation) {
          case "lighting":
            prompts.push(`${baseP}, dramatic lighting`, `${baseP}, soft lighting`);
            break;
          case "angle":
            prompts.push(`${baseP}, from above`, `${baseP}, close-up view`);
            break;
          case "color-palette":
            prompts.push(`${baseP}, warm colors`, `${baseP}, cool colors`);
            break;
          case "composition":
            prompts.push(`${baseP}, centered`, `${baseP}, rule of thirds`);
            break;
          case "mood":
            prompts.push(`${baseP}, cheerful mood`, `${baseP}, dramatic mood`);
            break;
          case "season":
            prompts.push(`${baseP}, in spring`, `${baseP}, in winter`);
            break;
          case "time-of-day":
            prompts.push(`${baseP}, at sunrise`, `${baseP}, at sunset`);
            break;
          default:
            prompts.push(baseP);
        }
      }
    }
  }
  
  return prompts.length > 0 ? prompts : [basePrompt];
}

// ============================================
// MAIN EXTENSION
// ============================================

export default function (pi: ExtensionAPI) {
  const model = process.env.NANOBANANA_MODEL || DEFAULT_IMAGE_MODEL;

  // ============================================
  // TOOL: generate_image
  // ============================================
  pi.registerTool({
    name: "generate_image",
    label: "Generate Image",
    description: "Generate images from text prompts. Use inputImage for style reference.",
    parameters: Type.Object({
      prompt: Type.String({ description: "The text prompt describing the image" }),
      inputImage: Type.Optional(Type.String({ description: "Path to reference image for style (optional)" })),
      outputCount: Type.Optional(Type.Number({ minimum: 1, maximum: 8 })),
      styles: Type.Optional(Type.Array(StringEnum(IMAGE_STYLES as readonly string[]))),
      variations: Type.Optional(Type.Array(StringEnum(VARIATION_TYPES as readonly string[]))),
      aspectRatio: Type.Optional(StringEnum(ASPECT_RATIOS as readonly string[])),
      format: Type.Optional(StringEnum(["grid", "separate"] as const)),
      seed: Type.Optional(Type.Number()),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No Google API key found. Configure via GEMINI_API_KEY or auth.json");

      // Load style reference image if provided
      let referenceBase64: string | undefined;
      if (params.inputImage) {
        const fileResult = findInputFile(params.inputImage);
        if (!fileResult.found || !fileResult.filePath) {
          throw new Error(`Reference image not found: ${params.inputImage}`);
        }
        referenceBase64 = await readImageAsBase64(fileResult.filePath);
        onUpdate?.({ content: [{ type: "text", text: `Using style reference: ${params.inputImage}` }] });
      }

      let prompts = [params.prompt];
      if (params.styles?.length || params.variations?.length) {
        prompts = buildVariationsPrompt(params.prompt, params.styles, params.variations);
      }
      if (params.outputCount && prompts.length < params.outputCount) {
        prompts = Array(params.outputCount).fill(params.prompt);
      }
      if (params.outputCount) {
        prompts = prompts.slice(0, params.outputCount);
      }

      onUpdate?.({ content: [{ type: "text", text: `Generating ${prompts.length} image(s)...` }] });

      const files: string[] = [];

      for (let i = 0; i < prompts.length; i++) {
        let fullPrompt = prompts[i];
        if (params.aspectRatio) {
          fullPrompt += `. Aspect ratio: ${params.aspectRatio}`;
        }

        let imageBase64: string;
        if (referenceBase64) {
          // Style reference mode
          imageBase64 = await generateImageWithImage(apiKey, model, fullPrompt, referenceBase64, "image/png", signal);
        } else {
          imageBase64 = await generateImage(apiKey, model, fullPrompt, signal);
        }
        
        const filename = generateFilename(prompts[i], "png", i, files);
        const filepath = await saveImage(imageBase64, filename);
        files.push(filepath);

        onUpdate?.({ 
          content: [{ type: "text", text: `Generated ${i + 1}/${prompts.length}: ${filepath}` }],
          details: { progress: Math.round(((i + 1) / prompts.length) * 100) }
        });
      }

      return {
        content: [{ type: "text", text: files.length === 1 
          ? `Generated: ${files[0]}` 
          : `Generated ${files.length} images:\n${files.map(f => `- ${f}`).join("\n")}` }],
        details: { files }
      };
    },
  });

  // ============================================
  // TOOL: edit_image
  // ============================================
  pi.registerTool({
    name: "edit_image",
    label: "Edit Image",
    description: "Edit an existing image based on a text prompt. Provide the image file path.",
    parameters: Type.Object({
      prompt: Type.String({ description: "The text prompt describing the edits to make" }),
      file: Type.String({ description: "Path to the image file to edit" }),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No Google API key found");

      // Find the input image
      const fileResult = findInputFile(params.file);
      if (!fileResult.found || !fileResult.filePath) {
        throw new Error(`Input image not found: ${params.file}`);
      }

      onUpdate?.({ content: [{ type: "text", text: "Editing image..." }] });

      const imageBase64 = await readImageAsBase64(fileResult.filePath);
      const resultBase64 = await generateImageWithImage(apiKey, model, params.prompt, imageBase64, "image/png", signal);
      
      const filename = generateFilename(params.prompt, "png");
      const filepath = await saveImage(resultBase64, filename);

      return {
        content: [{ type: "text", text: `Edited image: ${filepath}` }],
        details: { file: filepath, original: params.file }
      };
    },
  });

  // ============================================
  // TOOL: restore_image
  // ============================================
  pi.registerTool({
    name: "restore_image",
    label: "Restore Image",
    description: "Restore or enhance an existing image.",
    parameters: Type.Object({
      prompt: Type.Optional(Type.String({ description: "Specific restoration instructions (optional)" })),
      file: Type.String({ description: "Path to the image file to restore" }),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No Google API key found");

      const fileResult = findInputFile(params.file);
      if (!fileResult.found || !fileResult.filePath) {
        throw new Error(`Input image not found: ${params.file}`);
      }

      const restorePrompt = params.prompt || 
        "Restore and enhance this image. Improve quality, remove any defects.";

      onUpdate?.({ content: [{ type: "text", text: "Restoring image..." }] });

      const imageBase64 = await readImageAsBase64(fileResult.filePath);
      const resultBase64 = await generateImageWithImage(apiKey, model, restorePrompt, imageBase64, "image/png", signal);
      
      const filename = generateFilename(restorePrompt, "png");
      const filepath = await saveImage(resultBase64, filename);

      return {
        content: [{ type: "text", text: `Restored image: ${filepath}` }],
        details: { file: filepath, original: params.file }
      };
    },
  });

  // ============================================
  // TOOL: generate_icon
  // ============================================
  pi.registerTool({
    name: "generate_icon",
    label: "Generate Icon",
    description: "Generate app icons, favicons, and UI elements.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Description of the icon" }),
      sizes: Type.Optional(Type.Array(Type.Number())),
      type: Type.Optional(StringEnum(["app-icon", "favicon", "ui-element"] as const)),
      style: Type.Optional(StringEnum(["flat", "skeuomorphic", "minimal", "modern"] as const)),
      format: Type.Optional(StringEnum(["png", "jpeg"] as const)),
      background: Type.Optional(StringEnum(["transparent", "solid", "gradient"] as const)),
      corners: Type.Optional(StringEnum(["rounded", "sharp"] as const)),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No Google API key found");

      let fullPrompt = `Icon: ${params.prompt}`;
      if (params.type) fullPrompt += `. Type: ${params.type}`;
      if (params.style) fullPrompt += `. Style: ${params.style}`;
      if (params.background) fullPrompt += `. Background: ${params.background}`;
      if (params.corners) fullPrompt += `. Corners: ${params.corners}`;

      onUpdate?.({ content: [{ type: "text", text: "Generating icon..." }] });

      const imageBase64 = await generateImage(apiKey, model, fullPrompt, signal);
      const ext = params.format || "png";
      const filename = generateFilename(`icon_${params.prompt.replace(/\s+/g, "_")}`, ext);
      const filepath = await saveImage(imageBase64, filename);

      return {
        content: [{ type: "text", text: `Generated icon: ${filepath}` }],
        details: { file: filepath }
      };
    },
  });

  // ============================================
  // TOOL: generate_pattern
  // ============================================
  pi.registerTool({
    name: "generate_pattern",
    label: "Generate Pattern",
    description: "Generate seamless patterns and textures.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Pattern description" }),
      type: Type.Optional(StringEnum(["seamless", "texture", "wallpaper"] as const)),
      style: Type.Optional(StringEnum(["geometric", "organic", "abstract", "floral", "tech"] as const)),
      density: Type.Optional(StringEnum(["sparse", "medium", "dense"] as const)),
      colors: Type.Optional(StringEnum(["mono", "duotone", "colorful"] as const)),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No Google API key found");

      let fullPrompt = `Pattern: ${params.prompt}`;
      if (params.type) fullPrompt += `. Type: ${params.type}`;
      if (params.style) fullPrompt += `. Style: ${params.style}`;
      if (params.density) fullPrompt += `. Density: ${params.density}`;
      if (params.colors) fullPrompt += `. Colors: ${params.colors}`;

      onUpdate?.({ content: [{ type: "text", text: "Generating pattern..." }] });

      const imageBase64 = await generateImage(apiKey, model, fullPrompt, signal);
      const filename = generateFilename(`pattern_${params.prompt.replace(/\s+/g, "_")}`, "png");
      const filepath = await saveImage(imageBase64, filename);

      return {
        content: [{ type: "text", text: `Generated pattern: ${filepath}` }],
        details: { file: filepath }
      };
    },
  });

  // ============================================
  // TOOL: generate_diagram
  // ============================================
  pi.registerTool({
    name: "generate_diagram",
    label: "Generate Diagram",
    description: "Generate technical diagrams and flowcharts.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Diagram description" }),
      type: Type.Optional(StringEnum([
        "flowchart", "architecture", "network", "database", 
        "wireframe", "mindmap", "sequence"
      ] as const)),
      style: Type.Optional(StringEnum(["professional", "clean", "hand-drawn", "technical"] as const)),
      layout: Type.Optional(StringEnum(["horizontal", "vertical", "hierarchical", "circular"] as const)),
      complexity: Type.Optional(StringEnum(["simple", "detailed", "comprehensive"] as const)),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No Google API key found");

      let fullPrompt = `Diagram: ${params.prompt}`;
      if (params.type) fullPrompt += `. Type: ${params.type}`;
      if (params.style) fullPrompt += `. Style: ${params.style}`;
      if (params.layout) fullPrompt += `. Layout: ${params.layout}`;
      if (params.complexity) fullPrompt += `. Complexity: ${params.complexity}`;

      onUpdate?.({ content: [{ type: "text", text: "Generating diagram..." }] });

      const imageBase64 = await generateImage(apiKey, model, fullPrompt, signal);
      const filename = generateFilename(`diagram_${params.prompt.replace(/\s+/g, "_")}`, "png");
      const filepath = await saveImage(imageBase64, filename);

      return {
        content: [{ type: "text", text: `Generated diagram: ${filepath}` }],
        details: { file: filepath }
      };
    },
  });

  // ============================================
  // TOOL: generate_story
  // ============================================
  pi.registerTool({
    name: "generate_story",
    label: "Generate Story",
    description: "Generate multi-panel image sequences.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Story/narrative description" }),
      steps: Type.Optional(Type.Number({ minimum: 2, maximum: 8 })),
      type: Type.Optional(StringEnum(["story", "process", "tutorial", "timeline"] as const)),
      style: Type.Optional(StringEnum(["consistent", "evolving"] as const)),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No Google API key found");

      const steps = params.steps || 4;
      onUpdate?.({ content: [{ type: "text", text: `Generating ${steps} story panels...` }] });

      const files: string[] = [];

      for (let i = 0; i < steps; i++) {
        const stepNumber = i + 1;
        let fullPrompt = `${params.prompt}, step ${stepNumber} of ${steps}`;
        if (params.type) fullPrompt += `. Type: ${params.type}`;
        if (params.style) fullPrompt += `. Style: ${params.style}`;

        const imageBase64 = await generateImage(apiKey, model, fullPrompt, signal);
        const filename = generateFilename(`story_${stepNumber}_${params.prompt.replace(/\s+/g, "_")}`, "png");
        const filepath = await saveImage(imageBase64, filename);
        files.push(filepath);

        onUpdate?.({ 
          content: [{ type: "text", text: `Generated panel ${stepNumber}/${steps}` }],
          details: { progress: Math.round((stepNumber / steps) * 100) }
        });
      }

      return {
        content: [{ type: "text", text: `Generated ${files.length} story panels:\n${files.map(f => `- ${f}`).join("\n")}` }],
        details: { files }
      };
    },
  });

  // ============================================
  // NOTIFY ON LOAD
  // ============================================
  pi.on("session_start", async (_event, ctx) => {
    const outputDir = join(ctx.cwd, "nanobanana-output");
    ctx.ui.notify(
      `Nano Banana v1.0.0 loaded\n` +
      `Model: ${model}\n` +
      `Output: ${outputDir}`,
      "success"
    );
  });
}
