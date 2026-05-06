const schemaPaths = {
    "ES/1.0": "schemas/ES/1.0.json",
    "ES/1.1": "schemas/ES/1.1.json",
    "ES/1.2": "schemas/ES/1.2.json",
};

const relevantFields = [
    ["guid", "GUID"],
    ["listingStatus", "Status"],
    ["operation", "Operation"],
    ["propertyType", "Property type"],
    ["propertySubtype", "Subtype"],
    ["price", "Price"],
    ["propertySize", "Property size"],
    ["bedrooms", "Bedrooms"],
    ["bathrooms", "Bathrooms"],
    ["address", "Address"],
    ["listingDate", "Listing date"],
    ["sourceName", "Source"],
];

let selectedSchema = null;
let selectedSchemaVersion = "ES/1.2";
let loadedFile = null;
let loadedJson = null;
let table = null;

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    initializeTable();
    loadSelectedSchema();
});

function bindElements() {
    elements.schemaVersion = document.getElementById("schema-version");
    elements.jsonFile = document.getElementById("json-file");
    elements.clearButton = document.getElementById("clear-button");
    elements.statusPill = document.getElementById("status-pill");
    elements.fileTitle = document.getElementById("file-title");
    elements.fileMeta = document.getElementById("file-meta");
    elements.summaryCount = document.getElementById("summary-count");
    elements.summaryCreated = document.getElementById("summary-created");
    elements.summarySchema = document.getElementById("summary-schema");
    elements.dropPanel = document.getElementById("drop-panel");
    elements.dragOverlay = document.getElementById("drag-overlay");
    elements.errorsPanel = document.getElementById("errors-panel");
    elements.errorsList = document.getElementById("errors-list");
    elements.dismissErrors = document.getElementById("dismiss-errors");
    elements.dialog = document.getElementById("listing-dialog");
    elements.dialogClose = document.getElementById("dialog-close");
    elements.dialogStatus = document.getElementById("dialog-status");
    elements.dialogTitle = document.getElementById("dialog-title");
    elements.dialogSubtitle = document.getElementById("dialog-subtitle");
    elements.dialogMedia = document.getElementById("dialog-media");
    elements.dialogHighlights = document.getElementById("dialog-highlights");
    elements.dialogJson = document.getElementById("dialog-json");
    elements.copyJson = document.getElementById("copy-json");
}

function bindEvents() {
    elements.schemaVersion.addEventListener("change", async () => {
        selectedSchemaVersion = elements.schemaVersion.value;
        await loadSelectedSchema();
        if (loadedFile) {
            validateAndRender(loadedJson, loadedFile.name);
        }
    });

    elements.jsonFile.addEventListener("change", (event) => {
        const [file] = event.target.files;
        if (file) {
            readFile(file);
        }
    });

    elements.clearButton.addEventListener("click", resetViewer);
    elements.dismissErrors.addEventListener("click", () => hideErrors());
    elements.dialogClose.addEventListener("click", () => elements.dialog.close());
    elements.copyJson.addEventListener("click", copyDialogJson);

    window.addEventListener("dragenter", showDragOverlay);
    elements.dragOverlay.addEventListener("dragover", allowDrop);
    elements.dragOverlay.addEventListener("dragleave", hideDragOverlay);
    elements.dragOverlay.addEventListener("drop", handleDrop);
}

async function loadSelectedSchema() {
    selectedSchemaVersion = elements.schemaVersion.value;
    setStatus("idle", "Loading schema", `Preparing ${selectedSchemaVersion} validation.`);

    try {
        const response = await fetch(schemaPaths[selectedSchemaVersion], { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Schema request failed with HTTP ${response.status}.`);
        }

        selectedSchema = normalizeSchema(await response.json());
        normalizePropertySubtypeSchema(selectedSchema);
        setStatus("idle", "No file loaded", `${selectedSchemaVersion} schema is ready.`);
    } catch (error) {
        selectedSchema = null;
        showErrorMessages([
            `Could not load ${selectedSchemaVersion}: ${error.message}`,
            "Serve this folder through a local web server if the browser blocks local schema files.",
        ]);
        setStatus("invalid", "Schema unavailable", "The selected schema could not be loaded.");
    }
}

function initializeTable() {
    table = new Tabulator("#listings-table", {
        data: [],
        height: "100%",
        layout: "fitColumns",
        placeholder: "Load a valid ORELS JSON file to inspect listings.",
        pagination: "local",
        paginationSize: 25,
        paginationSizeSelector: [10, 25, 50, 100, true],
        movableColumns: true,
        initialSort: [{ column: "listingDate", dir: "desc" }],
        columns: [
            { title: "#", field: "rowNumber", width: 64, hozAlign: "right", headerSort: false },
            { title: "GUID", field: "guid", minWidth: 180, headerFilter: "input", formatter: strongFormatter },
            { title: "Status", field: "listingStatus", width: 128, headerFilter: "list", headerFilterParams: { valuesLookup: true, clearable: true } },
            { title: "Operation", field: "operation", width: 126, headerFilter: "list", headerFilterParams: { valuesLookup: true, clearable: true } },
            { title: "Type", field: "propertyType", width: 136, headerFilter: "list", headerFilterParams: { valuesLookup: true, clearable: true } },
            { title: "Subtype", field: "propertySubtype", width: 150, headerFilter: "list", headerFilterParams: { valuesLookup: true, clearable: true } },
            { title: "Price", field: "priceAmount", width: 132, sorter: "number", sorterParams: { alignEmptyValues: "bottom" }, formatter: (cell) => cell.getData().priceDisplay || "" },
            { title: "Size", field: "propertySize", width: 100, hozAlign: "right", sorter: "number", headerFilter: "number" },
            { title: "Beds", field: "bedrooms", width: 92, hozAlign: "right", sorter: "number", headerFilter: "number" },
            { title: "Baths", field: "bathrooms", width: 96, hozAlign: "right", sorter: "number", headerFilter: "number" },
            { title: "Address", field: "address", minWidth: 220, headerFilter: "input" },
            { title: "Listing date", field: "listingDate", width: 170, headerFilter: "input" },
            { title: "Source", field: "sourceName", width: 160, headerFilter: "input" },
        ],
    });

    table.on("rowClick", (_event, row) => openListing(row.getData().listing));
}

function strongFormatter(cell) {
    return `<span class="cell-strong">${escapeHtml(cell.getValue() || "-")}</span>`;
}

function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            loadedFile = file;
            loadedJson = JSON.parse(String(reader.result));
            validateAndRender(loadedJson, file.name);
        } catch (error) {
            loadedFile = file;
            loadedJson = null;
            table.clearData();
            updateSummary(null);
            showErrorMessages([`The file could not be parsed as JSON: ${error.message}`]);
            setStatus("invalid", file.name, "Invalid JSON syntax.");
        }
    };
    reader.onerror = () => {
        showErrorMessages([`The file could not be read: ${reader.error?.message || "Unknown error"}`]);
        setStatus("invalid", file.name, "File reading failed.");
    };
    reader.readAsText(file);
}

function validateAndRender(json, fileName) {
    hideErrors();

    if (!selectedSchema) {
        showErrorMessages(["No schema is available. Select a schema version and try again."]);
        setStatus("invalid", fileName, "Validation could not run.");
        return;
    }

    if (typeof Ajv === "undefined") {
        showErrorMessages(["AJV did not load. Check your network connection and reload the page."]);
        setStatus("invalid", fileName, "Validator library unavailable.");
        return;
    }

    const ajv = new Ajv({
        allErrors: true,
        jsonPointers: true,
        verbose: true,
    });

    const validate = ajv.compile(selectedSchema);
    const isValid = validate(json);

    if (!isValid) {
        table.clearData();
        updateSummary(null);
        elements.dropPanel.classList.remove("is-hidden");
        showErrorMessages(validate.errors.map(formatValidationError));
        setStatus("invalid", fileName, `${validate.errors.length} validation error${validate.errors.length === 1 ? "" : "s"} found.`);
        return;
    }

    const listings = Array.isArray(json.listings) ? json.listings : [];
    table.setData(listings.map(toTableRow));
    updateSummary(json);
    elements.dropPanel.classList.add("is-hidden");
    hideErrors();
    setStatus("valid", fileName, `${listings.length} listing${listings.length === 1 ? "" : "s"} validated with ${selectedSchemaVersion}.`);
}

function toTableRow(listing, index) {
    const source = Array.isArray(listing.sources) ? listing.sources[0] : null;

    return {
        rowNumber: index + 1,
        guid: listing.guid || "",
        listingStatus: listing.listingStatus || "",
        operation: listing.operation || "",
        propertyType: listing.propertyType || "",
        propertySubtype: listing.propertySubtype || "",
        priceAmount: listing.price?.amount ?? null,
        priceDisplay: formatPrice(listing.price),
        propertySize: listing.propertySize ?? "",
        bedrooms: listing.bedrooms ?? "",
        bathrooms: listing.bathrooms ?? "",
        address: listing.address || "",
        listingDate: formatDate(listing.listingDate),
        sourceName: source?.sourceName || "",
        listing,
    };
}

function updateSummary(json) {
    if (!json) {
        elements.summaryCount.textContent = "0";
        elements.summaryCreated.textContent = "-";
        elements.summarySchema.textContent = "-";
        return;
    }

    elements.summaryCount.textContent = String(Array.isArray(json.listings) ? json.listings.length : 0);
    elements.summaryCreated.textContent = formatDate(json.created) || "-";
    elements.summarySchema.textContent = json.schemaUrl || selectedSchemaVersion;
}

function setStatus(kind, title, meta) {
    elements.statusPill.className = `status-pill status-pill--${kind}`;
    elements.statusPill.textContent = kind === "valid" ? "Valid file" : kind === "invalid" ? "Needs attention" : "Ready";
    elements.fileTitle.textContent = title;
    elements.fileMeta.textContent = meta;
}

function showErrorMessages(messages) {
    elements.errorsList.replaceChildren();
    messages.forEach((message) => {
        const item = document.createElement("li");
        item.textContent = message;
        elements.errorsList.appendChild(item);
    });
    elements.errorsPanel.classList.remove("is-hidden");
}

function hideErrors() {
    elements.errorsPanel.classList.add("is-hidden");
    elements.errorsList.replaceChildren();
}

function formatValidationError(error) {
    const path = error.dataPath || error.instancePath || "";
    const missingProperty = error.params?.missingProperty ? `.${error.params.missingProperty}` : "";
    const location = `${path || "(root)"}${missingProperty}`;
    return `${location}: ${error.message || "Invalid value"}`;
}

function resetViewer() {
    loadedFile = null;
    loadedJson = null;
    elements.jsonFile.value = "";
    table.clearData();
    updateSummary(null);
    elements.dropPanel.classList.remove("is-hidden");
    hideErrors();
    setStatus("idle", "No file loaded", `${selectedSchemaVersion} schema is ready.`);
}

function allowDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
}

function showDragOverlay(event) {
    if (event.dataTransfer?.types?.includes("Files")) {
        elements.dragOverlay.classList.add("is-visible");
    }
}

function hideDragOverlay() {
    elements.dragOverlay.classList.remove("is-visible");
}

function handleDrop(event) {
    event.preventDefault();
    hideDragOverlay();

    const [file] = event.dataTransfer.files;
    if (file) {
        readFile(file);
    }
}

function openListing(listing) {
    const title = listing.guid || "Listing details";
    elements.dialogStatus.textContent = listing.listingStatus || "Listing";
    elements.dialogTitle.textContent = title;
    elements.dialogSubtitle.textContent = [listing.operation, listing.propertyType, listing.address].filter(Boolean).join(" / ");
    elements.dialogHighlights.replaceChildren(...buildHighlights(listing));
    renderMedia(listing);
    elements.dialogJson.textContent = JSON.stringify(listing, null, 2);
    elements.dialog.showModal();
}

function buildHighlights(listing) {
    const source = Array.isArray(listing.sources) ? listing.sources[0] : null;
    const values = {
        guid: listing.guid,
        listingStatus: listing.listingStatus,
        operation: listing.operation,
        propertyType: listing.propertyType,
        propertySubtype: listing.propertySubtype,
        price: formatPrice(listing.price),
        propertySize: listing.propertySize,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        address: listing.address,
        listingDate: formatDate(listing.listingDate),
        sourceName: {
            text: source?.sourceName,
            url: source?.sourceUrl,
        },
    };

    return relevantFields.map(([key, label]) => {
        const item = document.createElement("div");
        item.className = "detail-item";
        const itemLabel = document.createElement("span");
        itemLabel.textContent = label;

        let itemValue;
        if (key === "sourceName" && values.sourceName?.url) {
            itemValue = document.createElement("a");
            itemValue.href = values.sourceName.url;
            itemValue.target = "_blank";
            itemValue.rel = "noopener noreferrer";
            itemValue.textContent = values.sourceName.text || values.sourceName.url;
        } else {
            itemValue = document.createElement("strong");
            itemValue.textContent = key === "sourceName" ? values.sourceName?.text || "-" : values[key] ?? "-";
        }

        item.append(itemLabel, itemValue);
        return item;
    });
}

function renderMedia(listing) {
    elements.dialogMedia.replaceChildren();
    const mediaItems = Array.isArray(listing.media) ? listing.media : [];

    mediaItems.forEach((media) => {
        if (!media?.url) {
            return;
        }

        const link = document.createElement("a");
        link.href = media.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = [media.title, media.mediaType, media.url].filter(Boolean).join("\n");

        if (media.mediaType === "image") {
            const image = document.createElement("img");
            image.loading = "lazy";
            image.src = media.url;
            image.alt = media.title || media.url;
            link.appendChild(image);
        } else {
            link.className = "media-link";
            link.textContent = media.title || media.mediaType || "Open media";
        }

        elements.dialogMedia.appendChild(link);
    });

    elements.dialogMedia.classList.toggle("is-hidden", elements.dialogMedia.childElementCount === 0);
}

async function copyDialogJson() {
    try {
        await navigator.clipboard.writeText(elements.dialogJson.textContent);
        elements.copyJson.textContent = "Copied";
        window.setTimeout(() => {
            elements.copyJson.textContent = "Copy JSON";
        }, 1200);
    } catch {
        elements.copyJson.textContent = "Copy failed";
        window.setTimeout(() => {
            elements.copyJson.textContent = "Copy JSON";
        }, 1200);
    }
}

function normalizeSchema(schemaNode) {
    if (Array.isArray(schemaNode)) {
        schemaNode.forEach(normalizeSchema);
        return schemaNode;
    }

    if (!schemaNode || typeof schemaNode !== "object") {
        return schemaNode;
    }

    if (Object.hasOwn(schemaNode, "const") && !Object.hasOwn(schemaNode, "enum")) {
        schemaNode.enum = [schemaNode.const];
        delete schemaNode.const;
    }

    Object.keys(schemaNode).forEach((key) => normalizeSchema(schemaNode[key]));
    return schemaNode;
}

function normalizePropertySubtypeSchema(schema) {
    const listingSchema = schema?.properties?.listings?.items;
    const propertySubtypeSchema = listingSchema?.properties?.propertySubtype;
    const homeSubtypes = propertySubtypeSchema?.then?.enum;
    const landSubtypes = propertySubtypeSchema?.else?.then?.enum;

    if (!listingSchema || !propertySubtypeSchema || !homeSubtypes || !landSubtypes) {
        return;
    }

    delete propertySubtypeSchema.if;
    delete propertySubtypeSchema.then;
    delete propertySubtypeSchema.else;

    listingSchema.allOf = listingSchema.allOf || [];
    listingSchema.allOf.push(
        {
            if: {
                properties: {
                    propertyType: { enum: ["home"] },
                },
                required: ["propertyType"],
            },
            then: {
                properties: {
                    propertySubtype: { enum: homeSubtypes },
                },
            },
        },
        {
            if: {
                properties: {
                    propertyType: { enum: ["land"] },
                },
                required: ["propertyType"],
            },
            then: {
                properties: {
                    propertySubtype: { enum: landSubtypes },
                },
            },
        }
    );
}

function formatPrice(price) {
    if (!price || typeof price.amount !== "number") {
        return "";
    }

    try {
        return new Intl.NumberFormat("en", {
            style: "currency",
            currency: price.currency || "EUR",
            maximumFractionDigits: 0,
        }).format(price.amount);
    } catch {
        return `${price.amount} ${price.currency || ""}`.trim();
    }
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(date);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
