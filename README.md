# Static Site Generator

A simple static site generator that converts Markdown content into HTML pages.

## Features

- Converts Markdown to HTML
- Clean, responsive design
- Simple directory structure
- Fast static file serving

## Directory Structure

```
src/
  ├── pages/       # Markdown content for pages
  ├── blog/        # Markdown content for blog posts
  ├── css/         # Stylesheets
  └── template.html # HTML template for all pages

dist/              # Generated static site
```

## Usage

1. Add Markdown files to `src/pages/` or `src/blog/`
2. Run `npm run build` to generate the static site
3. Run `npm start` to serve the site locally

The site will be available at http://localhost:3000