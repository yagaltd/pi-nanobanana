# Nano Banana

![Nano Banana](cover.png)

Image generation for [pi-coding-agent](https://github.com/badlogic/pi-mono) using Google Gemini AI.

Generate images, icons, patterns, diagrams, stories, and more.

## Install

```bash
pi install https://github.com/yagaltd/pi-nanobanana
```

## Use It

Just describe what you want and pi will use the right tool:

```
Generate a sunset over mountains
Create a logo for my app
Design a seamless pattern
Make a flowchart of our system
Edit this photo to add vintage style
Restore this old photo
```

## Tools

| Tool | Use When |
|------|----------|
| `generate_image` | Creating new images from text |
| `edit_image` | Modifying an existing image |
| `restore_image` | Enhancing/fixing a damaged image |
| `generate_icon` | App icons, favicons |
| `generate_pattern` | Seamless patterns |
| `generate_diagram` | Flowcharts, architecture diagrams |
| `generate_story` | Multi-panel sequences |

## Output

Images are saved to `./nanobanana-output/` in your current working directory.

## Quick Reference

```
generate_image prompt="A sunset" styles=photorealistic aspectRatio=16:9
generate_icon prompt="Rocket" type=app-icon sizes=256,512
generate_diagram prompt="System architecture" type=flowchart complexity=detailed
```

## License

MIT
