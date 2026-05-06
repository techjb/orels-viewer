# ORELS Viewer

ORELS Viewer is a static web application for validating and inspecting JSON files that follow the Open Real Estate Listings Schema.

The viewer lets a user choose an ORELS schema version, load a JSON file, validate it in the browser, and review the listings in a full-screen data table. Valid files are shown with filtering, sorting, pagination, and a full-screen listing detail view.

## Online Viewer

Open the public viewer here:

https://techjb.github.io/orels-viewer/

## Features

- Validate ORELS JSON files against ES schema versions 1.0, 1.1, and 1.2.
- Show validation errors before rendering listing data.
- Display valid listings in a full-screen table with column filters, sorting, and pagination.
- Open any listing to inspect highlights, media links, source links, and the complete JSON payload.
- Run entirely in the browser as a static site.

## GitHub Pages

This project is published with GitHub Pages.

Repository:

https://github.com/techjb/orels-viewer

## Run locally

Serve the folder with any static web server, then open the local URL.

```powershell
python -m http.server 5177
```

Then visit:

http://localhost:5177/

The viewer includes local copies of the ES schemas for versions 1.0, 1.1, and 1.2. The table UI uses Tabulator and validation uses AJV.
