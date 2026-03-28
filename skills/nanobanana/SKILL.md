# Nano Banana - pi Extension

This skill teaches pi about the Nano Banana image generation extension.

## What is Nano Banana?

Nano Banana provides Gemini AI image generation capabilities for pi-coding-agent.

## Tools

| Tool | Use When |
|------|----------|
| `generate_image` | Creating **new** images from text only |
| `edit_image` | **Modifying** an existing image (provide file path) |
| `restore_image` | **Enhancing/fixing** a damaged image (provide file path) |
| `generate_icon` | Creating app icons, favicons |
| `generate_pattern` | Creating seamless patterns |
| `generate_diagram` | Creating technical diagrams |
| `generate_story` | Creating multi-panel sequences |

## Image vs Edit vs Restore

### Generate (new image from text)
```
User: "Generate a sunset over mountains"
→ Use generate_image with prompt="A sunset over mountains"
```

### Edit (modify existing image)
```
User: "Add a purple background to this photo" [with image]
→ Use edit_image with:
  - file: "<path to image>"
  - prompt: "Add a purple background"
```

### Restore (fix damaged image)
```
User: "Remove scratches from this old photo" [with image]
→ Use restore_image with:
  - file: "<path to image>"
  - prompt: "Remove scratches and restore" (optional)
```

## Tool Parameters

### generate_image
```
prompt: string (required)
outputCount?: number (1-8)
styles?: photorealistic, watercolor, oil-painting, sketch, pixel-art, anime, vintage, modern, abstract, minimalist
variations?: lighting, angle, color-palette, composition, mood, season, time-of-day
aspectRatio?: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
format?: "grid" | "separate"
seed?: number
```

### edit_image
```
prompt: string (required) - edit instructions
file: string (required) - path to image to edit
```

### restore_image
```
file: string (required) - path to image to restore
prompt?: string - specific restoration instructions
```

### generate_icon
```
prompt: string (required)
sizes?: number[] (16, 32, 64, 128, 256, 512, 1024)
type?: "app-icon" | "favicon" | "ui-element"
style?: "flat" | "skeuomorphic" | "minimal" | "modern"
format?: "png" | "jpeg"
```

### generate_pattern
```
prompt: string (required)
type?: "seamless" | "texture" | "wallpaper"
style?: "geometric" | "organic" | "abstract" | "floral" | "tech"
density?: "sparse" | "medium" | "dense"
colors?: "mono" | "duotone" | "colorful"
```

### generate_diagram
```
prompt: string (required)
type?: "flowchart" | "architecture" | "network" | "database" | "wireframe" | "mindmap" | "sequence"
style?: "professional" | "clean" | "hand-drawn" | "technical"
layout?: "horizontal" | "vertical" | "hierarchical" | "circular"
complexity?: "simple" | "detailed" | "comprehensive"
```

### generate_story
```
prompt: string (required)
steps?: number (2-8, default: 4)
type?: "story" | "process" | "tutorial" | "timeline"
style?: "consistent" | "evolving"
```

## Output

Images are saved to `./nanobanana-output/` in the current working directory.

## Best Practices

1. **For new images from text**: Use `generate_image`
2. **For modifying existing images**: Use `edit_image` with `file` parameter
3. **For fixing/restorating images**: Use `restore_image` with `file` parameter
4. **Use specific prompts**: "A red sports car at sunset" works better than "A car"
5. **Use styles for consistency**: Specify styles like "photorealistic" or "minimalist"
