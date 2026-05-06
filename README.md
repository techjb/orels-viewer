# ORELS Viewer

Static viewer for Open Real Estate Listings Schema JSON files.

## GitHub Pages

This is a static site. Publish the repository with GitHub Pages using the `main` branch and the repository root.

## Run locally

Serve the folder with any static web server, then open `index.html`.

```powershell
python -m http.server 5177
```

The viewer includes local copies of the ES schemas for versions 1.0, 1.1, and 1.2. The table UI uses Tabulator and validation uses AJV.
