const schemaPaths = {
    "ES/1.0": "schemas/ES/1.0.json",
    "ES/1.1": "schemas/ES/1.1.json",
    "ES/1.2": "schemas/ES/1.2.json",
    "ES/1.3": "schemas/ES/1.3.json",
};

const displayLocale = "es-ES";

const importantDetailFields = [
    "guid",
    "listingStatus",
    "listingDate",
    "unlistingDate",
    "operation",
    "propertyType",
    "propertySubtype",
    "price",
    "propertySize",
    "landSize",
    "constructionYear",
    "constructionStatus",
    "energyEfficiencyRating",
    "floors",
    "floor",
    "bedrooms",
    "bathrooms",
];

const featureDetailFields = [
    "parkings",
    "terrace",
    "garden",
    "garage",
    "motorbikeGarage",
    "pool",
    "lift",
    "disabledAccess",
    "storageRoom",
    "furnished",
    "nonFurnished",
    "heating",
    "airConditioning",
    "petsAllowed",
    "securitySystems",
];

const descriptionDetailFields = ["description"];

const locationDetailFields = [
    "address",
    "lauId",
    "lauName",
    "latitude",
    "longitude",
    "locationIsAccurate",
    "cadastralReference",
];

const contactDetailFields = [
    "contactName",
    "contactPhone",
    "contactEmail",
    "contactUrl",
    "contactOther",
];

const groupedDetailFields = new Set([
    ...importantDetailFields,
    ...featureDetailFields,
    ...descriptionDetailFields,
    ...locationDetailFields,
    ...contactDetailFields,
    "sources",
    "media",
]);

const fieldLabels = {
    guid: "GUID",
    listingStatus: "Status",
    listingDate: "Listing date",
    unlistingDate: "Unlisting date",
    operation: "Operation",
    propertyType: "Property type",
    propertySubtype: "Subtype",
    price: "Price",
    description: "Description",
    sources: "Sources",
    contactName: "Contact name",
    contactPhone: "Contact phone",
    contactEmail: "Contact email",
    contactUrl: "Contact URL",
    contactOther: "Contact other",
    address: "Address",
    lauId: "LAU ID",
    lauName: "LAU name",
    latitude: "Latitude",
    longitude: "Longitude",
    locationIsAccurate: "Location is accurate",
    cadastralReference: "Cadastral reference",
    propertySize: "Property size",
    landSize: "Land size",
    constructionYear: "Construction year",
    constructionStatus: "Construction status",
    energyEfficiencyRating: "Energy efficiency rating",
    floors: "Floors",
    floor: "Floor",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    parkings: "Parkings",
    terrace: "Terrace",
    garden: "Garden",
    garage: "Garage",
    motorbikeGarage: "Motorbike garage",
    pool: "Pool",
    lift: "Lift",
    disabledAccess: "Disabled access",
    storageRoom: "Storage room",
    furnished: "Furnished",
    nonFurnished: "Non furnished",
    heating: "Heating",
    airConditioning: "Air conditioning",
    petsAllowed: "Pets allowed",
    securitySystems: "Security systems",
};

const wideDetailFields = new Set(["description", "contactOther", "address"]);
const excludedDetailFields = new Set(["sources", "media"]);

let selectedSchema = null;
let selectedSchemaVersion = "ES/1.3";
let loadedFile = null;
let loadedJson = null;
let table = null;
let importWorker = null;
let importRunId = 0;
let isImporting = false;

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
    elements.fileButton = document.querySelector(".file-button");
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
    elements.dialogSources = document.getElementById("dialog-sources");
    elements.dialogSourcesList = document.getElementById("dialog-sources-list");
    elements.dialogHighlights = document.getElementById("dialog-highlights");
    elements.dialogJson = document.getElementById("dialog-json");
    elements.copyJson = document.getElementById("copy-json");
    elements.loadingOverlay = document.getElementById("loading-overlay");
    elements.loadingStage = document.getElementById("loading-stage");
    elements.loadingFile = document.getElementById("loading-file");
    elements.loadingProgress = document.getElementById("loading-progress");
    elements.loadingDetail = document.getElementById("loading-detail");
    elements.cancelLoad = document.getElementById("cancel-load");
}

function bindEvents() {
    elements.schemaVersion.addEventListener("change", async () => {
        const fileToReload = loadedFile;
        cancelImport("Schema changed. Import stopped.");
        selectedSchemaVersion = elements.schemaVersion.value;
        await loadSelectedSchema();
        if (fileToReload) {
            readFile(fileToReload);
        }
    });

    elements.jsonFile.addEventListener("change", (event) => {
        const [file] = event.target.files;
        if (file) {
            readFile(file);
        }
    });

    elements.clearButton.addEventListener("click", resetViewer);
    elements.cancelLoad.addEventListener("click", () => cancelImport("Import canceled."));
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
            { title: "Price", field: "priceAmount", width: 132, sorter: "number", sorterParams: { alignEmptyValues: "bottom" }, headerFilter: "number", formatter: (cell) => cell.getData().priceDisplay || "" },
            { title: "Built size", field: "propertySize", width: 116, hozAlign: "right", sorter: "number", headerFilter: "number", formatter: (cell) => formatSquareMeters(cell.getValue()) },
            { title: "Land size", field: "landSize", width: 112, hozAlign: "right", sorter: "number", headerFilter: "number", formatter: (cell) => formatSquareMeters(cell.getValue()) },
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
    if (!selectedSchema) {
        showErrorMessages(["No schema is available. Select a schema version and try again."]);
        setStatus("invalid", file.name, "Validation could not run.");
        return;
    }

    if (typeof Worker === "undefined") {
        readFileOnMainThread(file);
        return;
    }

    startWorkerImport(file);
}

function startWorkerImport(file) {
    cancelImport(null);
    hideErrors();
    loadedFile = file;
    loadedJson = null;
    importRunId += 1;
    isImporting = true;
    setImportControlsDisabled(true);
    table.clearData();
    updateSummary(null);
    elements.dropPanel.classList.add("is-hidden");
    setStatus("idle", file.name, `${formatFileSize(file.size)} selected. Import started.`);
    updateImportProgress({
        stage: "Reading file",
        fileName: file.name,
        fileSize: file.size,
        detail: "Reading JSON file...",
        percent: 0,
    });
    showImportOverlay();

    const runId = importRunId;
    importWorker = new Worker("assets/orels-worker.js");
    importWorker.onmessage = (event) => {
        if (runId !== importRunId) {
            return;
        }

        handleWorkerMessage(event.data, file, runId);
    };
    importWorker.onerror = (event) => {
        if (runId !== importRunId) {
            return;
        }

        finishImportWithError(file, `Import worker failed: ${event.message || "Unknown error"}`);
    };
    importWorker.postMessage({
        type: "process",
        file,
        schema: selectedSchema,
        schemaVersion: selectedSchemaVersion,
    });
}

function handleWorkerMessage(message, file, runId) {
    if (!message || typeof message !== "object") {
        return;
    }

    if (message.type === "progress") {
        updateImportProgress(message);
        return;
    }

    if (message.type === "error") {
        finishImportWithError(file, message.message || "The file could not be loaded.");
        return;
    }

    if (message.type === "result") {
        finishWorkerImport(message, file, runId);
    }
}

async function finishWorkerImport(result, file, runId) {
    updateImportProgress({
        stage: "Rendering table",
        fileName: file.name,
        fileSize: file.size,
        detail: "Preparing rows for display...",
        percent: 96,
    });
    await nextFrame();

    if (runId !== importRunId) {
        return;
    }

    cleanupImportWorker();
    isImporting = false;
    setImportControlsDisabled(false);

    if (!result.isFileUsable) {
        table.clearData();
        updateSummary(null);
        elements.dropPanel.classList.remove("is-hidden");
        showErrorMessages(result.fileErrors || ["The file does not match the selected ORELS schema."]);
        setStatus("invalid", file.name, `${result.fileErrorCount || result.fileErrors?.length || 0} validation error${result.fileErrorCount === 1 ? "" : "s"} found.`);
        hideImportOverlay();
        return;
    }

    table.setData(result.rows || []);
    updateSummaryFromImport(result.summary, result.validListingCount);
    elements.dropPanel.classList.add("is-hidden");

    if (result.listingErrorCount > 0) {
        const messages = result.listingErrors || [];
        if (result.listingErrorCount > messages.length) {
            messages.push(`${result.listingErrorCount - messages.length} additional listing validation errors were not shown.`);
        }
        showErrorMessages(messages);
        setStatus("invalid", file.name, `${result.validListingCount} of ${result.listingCount} listing${result.listingCount === 1 ? "" : "s"} loaded; ${result.listingErrorCount} validation error${result.listingErrorCount === 1 ? "" : "s"} found.`);
        hideImportOverlay();
        return;
    }

    hideErrors();
    setStatus("valid", file.name, `${result.listingCount} listing${result.listingCount === 1 ? "" : "s"} validated with ${selectedSchemaVersion}.`);
    hideImportOverlay();
}

function finishImportWithError(file, message) {
    cleanupImportWorker();
    isImporting = false;
    setImportControlsDisabled(false);
    table.clearData();
    updateSummary(null);
    elements.dropPanel.classList.remove("is-hidden");
    showErrorMessages([message]);
    setStatus("invalid", file.name, "File import failed.");
    hideImportOverlay();
}

function cancelImport(message) {
    if (!isImporting && !importWorker) {
        return;
    }

    importRunId += 1;
    cleanupImportWorker();
    isImporting = false;
    setImportControlsDisabled(false);
    hideImportOverlay();

    if (message) {
        setStatus("idle", loadedFile?.name || "No file loaded", message);
    }
}

function cleanupImportWorker() {
    if (importWorker) {
        importWorker.terminate();
        importWorker = null;
    }
}

function showImportOverlay() {
    elements.loadingOverlay.classList.remove("is-hidden");
}

function hideImportOverlay() {
    elements.loadingOverlay.classList.add("is-hidden");
    elements.loadingProgress.classList.remove("is-indeterminate");
}

function updateImportProgress({ stage, fileName, fileSize, detail, percent, indeterminate }) {
    elements.loadingStage.textContent = stage || "Loading";
    elements.loadingFile.textContent = [fileName, typeof fileSize === "number" ? formatFileSize(fileSize) : ""].filter(Boolean).join(" - ");
    elements.loadingDetail.textContent = detail || "";
    elements.loadingProgress.classList.toggle("is-indeterminate", Boolean(indeterminate));

    if (!indeterminate) {
        const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
        elements.loadingProgress.style.width = `${safePercent}%`;
    }
}

function setImportControlsDisabled(disabled) {
    elements.schemaVersion.disabled = disabled;
    elements.jsonFile.disabled = disabled;
    elements.clearButton.disabled = disabled;
    elements.fileButton.classList.toggle("is-disabled", disabled);
}

function readFileOnMainThread(file) {
    const reader = new FileReader();
    loadedFile = file;
    loadedJson = null;
    hideErrors();
    setImportControlsDisabled(true);
    updateImportProgress({
        stage: "Reading file",
        fileName: file.name,
        fileSize: file.size,
        detail: "Reading JSON file...",
        percent: 0,
    });
    showImportOverlay();

    reader.onprogress = (event) => {
        if (event.lengthComputable) {
            updateImportProgress({
                stage: "Reading file",
                fileName: file.name,
                fileSize: file.size,
                detail: `${formatFileSize(event.loaded)} of ${formatFileSize(event.total)} read.`,
                percent: Math.round((event.loaded / event.total) * 35),
            });
        }
    };
    reader.onload = async () => {
        updateImportProgress({
            stage: "Parsing JSON",
            fileName: file.name,
            fileSize: file.size,
            detail: "Parsing JSON in this browser tab...",
            percent: 40,
            indeterminate: true,
        });
        await nextFrame();

        try {
            loadedFile = file;
            loadedJson = JSON.parse(String(reader.result));
            validateAndRender(loadedJson, file.name);
            hideImportOverlay();
        } catch (error) {
            loadedFile = file;
            loadedJson = null;
            table.clearData();
            updateSummary(null);
            showErrorMessages([`The file could not be parsed as JSON: ${error.message}`]);
            setStatus("invalid", file.name, "Invalid JSON syntax.");
            hideImportOverlay();
        } finally {
            setImportControlsDisabled(false);
        }
    };
    reader.onerror = () => {
        showErrorMessages([`The file could not be read: ${reader.error?.message || "Unknown error"}`]);
        setStatus("invalid", file.name, "File reading failed.");
        setImportControlsDisabled(false);
        hideImportOverlay();
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
    configureAjvFormats(ajv);

    const validateFile = ajv.compile(createFileContainerSchema(selectedSchema));
    const isFileUsable = validateFile(json);

    if (!isFileUsable) {
        table.clearData();
        updateSummary(null);
        elements.dropPanel.classList.remove("is-hidden");
        showErrorMessages(validateFile.errors.map(formatValidationError));
        setStatus("invalid", fileName, `${validateFile.errors.length} validation error${validateFile.errors.length === 1 ? "" : "s"} found.`);
        return;
    }

    const listingSchema = getListingSchema(selectedSchema);
    if (!listingSchema) {
        table.clearData();
        updateSummary(null);
        elements.dropPanel.classList.remove("is-hidden");
        showErrorMessages(["The selected schema does not expose a listing definition."]);
        setStatus("invalid", fileName, "Validation could not run.");
        return;
    }

    const validateListing = ajv.compile(listingSchema);
    const listings = Array.isArray(json.listings) ? json.listings : [];
    const rows = [];
    const listingErrors = [];

    listings.forEach((listing, index) => {
        const isListingValid = validateListing(listing);

        if (isListingValid) {
            rows.push(toTableRow(listing, index));
            return;
        }

        (validateListing.errors || []).forEach((error) => {
            listingErrors.push(formatListingValidationError(error, listing, index));
        });
    });

    table.setData(rows);
    updateSummary(json, rows.length);
    elements.dropPanel.classList.add("is-hidden");

    if (listingErrors.length > 0) {
        showErrorMessages(listingErrors);
        setStatus("invalid", fileName, `${rows.length} of ${listings.length} listing${listings.length === 1 ? "" : "s"} loaded; ${listingErrors.length} validation error${listingErrors.length === 1 ? "" : "s"} found.`);
        return;
    }

    hideErrors();
    setStatus("valid", fileName, `${listings.length} listing${listings.length === 1 ? "" : "s"} validated with ${selectedSchemaVersion}.`);
}

function createFileContainerSchema(schema) {
    const fileSchema = structuredCloneFallback(schema);

    if (fileSchema?.properties?.listings) {
        fileSchema.properties.listings.items = true;
    }

    return fileSchema;
}

function getListingSchema(schema) {
    return schema?.properties?.listings?.items || null;
}

function structuredCloneFallback(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function configureAjvFormats(ajv) {
    ajv.addFormat("email", {
        type: "string",
        validate: isEmailWithInternationalDomain,
    });
}

function isEmailWithInternationalDomain(value) {
    if (typeof value !== "string" || value.length > 254) {
        return false;
    }

    const atIndex = value.indexOf("@");
    if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) {
        return false;
    }

    const localPart = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1);
    const asciiDomain = toAsciiDomain(domain);

    return isValidEmailLocalPart(localPart) && isValidHostname(asciiDomain);
}

function isValidEmailLocalPart(localPart) {
    return localPart.length <= 64
        && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)
        && !localPart.startsWith(".")
        && !localPart.endsWith(".")
        && !localPart.includes("..");
}

function toAsciiDomain(domain) {
    if (!domain || /[\s/:?#\\]/.test(domain)) {
        return "";
    }

    try {
        const url = new URL(`https://${domain}`);
        return url.hostname;
    } catch (_error) {
        return "";
    }
}

function isValidHostname(hostname) {
    if (!hostname || hostname.length > 253) {
        return false;
    }

    const labels = hostname.replace(/\.$/, "").split(".");
    if (labels.length < 2) {
        return false;
    }

    return labels.every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))
        && labels[labels.length - 1].length >= 2
        && !/^\d+$/.test(labels[labels.length - 1]);
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
        landSize: listing.landSize ?? "",
        bedrooms: listing.bedrooms ?? "",
        bathrooms: listing.bathrooms ?? "",
        address: listing.address || "",
        listingDate: formatDate(listing.listingDate),
        sourceName: source?.sourceName || "",
        listing,
    };
}

function updateSummary(json, validListingCount = null) {
    if (!json) {
        elements.summaryCount.textContent = "0";
        elements.summaryCreated.textContent = "-";
        elements.summarySchema.textContent = "-";
        return;
    }

    const listingCount = Array.isArray(json.listings) ? json.listings.length : 0;
    elements.summaryCount.textContent = validListingCount !== null && validListingCount !== listingCount
        ? `${validListingCount} / ${listingCount}`
        : String(listingCount);
    elements.summaryCreated.textContent = formatDate(json.created) || "-";
    elements.summarySchema.textContent = json.schemaUrl || selectedSchemaVersion;
}

function updateSummaryFromImport(summary, validListingCount = null) {
    if (!summary) {
        updateSummary(null);
        return;
    }

    const listingCount = summary.listingCount || 0;
    elements.summaryCount.textContent = validListingCount !== null && validListingCount !== listingCount
        ? `${validListingCount} / ${listingCount}`
        : String(listingCount);
    elements.summaryCreated.textContent = formatDate(summary.created) || "-";
    elements.summarySchema.textContent = summary.schemaUrl || selectedSchemaVersion;
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

function formatListingValidationError(error, listing, index) {
    const path = error.dataPath || error.instancePath || "";
    const missingProperty = error.params?.missingProperty ? `.${error.params.missingProperty}` : "";
    const location = `${path || "(listing)"}${missingProperty}`;
    const guid = typeof listing?.guid === "string" && listing.guid ? `, GUID ${listing.guid}` : "";

    return `Listing ${index + 1}${guid} ${location}: ${error.message || "Invalid value"}`;
}

function resetViewer() {
    cancelImport(null);
    loadedFile = null;
    loadedJson = null;
    elements.jsonFile.value = "";
    table.clearData();
    updateSummary(null);
    elements.dropPanel.classList.remove("is-hidden");
    hideErrors();
    setStatus("idle", "No file loaded", `${selectedSchemaVersion} schema is ready.`);
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) {
        return "";
    }

    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const maximumFractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;
    return `${formatNumber(value, { maximumFractionDigits })} ${units[unitIndex]}`;
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
    renderDialogSources(listing);
    elements.dialogJson.textContent = JSON.stringify(listing, null, 2);
    elements.dialog.showModal();
}

function buildHighlights(listing) {
    const renderedKeys = new Set(excludedDetailFields);
    const sections = [
        createDetailSection("Key details", importantDetailFields, listing, renderedKeys),
        createDetailSection("Features", featureDetailFields, listing, renderedKeys),
        createDetailSection("Description", descriptionDetailFields, listing, renderedKeys),
        createDetailSection("Location", locationDetailFields, listing, renderedKeys),
        createDetailSection("Contact", contactDetailFields, listing, renderedKeys),
    ];

    const otherKeys = Object.keys(listing).filter((key) => !groupedDetailFields.has(key) && !renderedKeys.has(key));
    sections.push(createDetailSection("Other details", otherKeys, listing, renderedKeys));

    return sections.filter(Boolean);
}

function createDetailSection(_title, keys, listing, renderedKeys) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const grid = document.createElement("div");
    grid.className = "detail-grid";

    keys.forEach((key) => {
        if (!Object.hasOwn(listing, key)) {
            return;
        }

        renderedKeys.add(key);
        const item = createDetailItem(key, listing[key]);
        if (item) {
            grid.appendChild(item);
        }
    });

    if (!grid.childElementCount) {
        return null;
    }

    section.appendChild(grid);
    return section;
}

function createDetailItem(key, value) {
    if (!hasDisplayValue(value)) {
        return null;
    }

    const item = document.createElement("div");
    item.className = `detail-item${wideDetailFields.has(key) ? " detail-item--wide" : ""}`;

    const itemLabel = document.createElement("span");
    itemLabel.textContent = fieldLabels[key] || toTitleLabel(key);
    item.appendChild(itemLabel);
    item.appendChild(renderDetailValue(key, value));

    return item;
}

function renderDetailValue(key, value) {
    if (key === "price") {
        return createStrongValue(formatPrice(value));
    }

    if (key === "propertySize" || key === "landSize") {
        return createStrongValue(formatSquareMeters(value));
    }

    if (key === "listingDate" || key === "unlistingDate" || key === "dataSourceUpdate") {
        return createStrongValue(formatDate(value) || value);
    }

    if (key === "contactEmail") {
        return createLinkValue(`mailto:${value}`, value);
    }

    if (key === "contactUrl" || key.endsWith("Url")) {
        return createLinkValue(value, value);
    }

    if (Array.isArray(value) || (value && typeof value === "object")) {
        return createPreValue(JSON.stringify(value, null, 2));
    }

    if (typeof value === "boolean") {
        return createStrongValue(value ? "Yes" : "No");
    }

    return createStrongValue(String(value));
}

function renderDialogSources(listing) {
    elements.dialogSourcesList.replaceChildren();
    const sources = Array.isArray(listing.sources) ? listing.sources : [];
    const sourcesContent = renderSources(sources);

    if (!sourcesContent) {
        elements.dialogSources.classList.add("is-hidden");
        return;
    }

    elements.dialogSourcesList.appendChild(sourcesContent);
    elements.dialogSources.classList.remove("is-hidden");
}

function renderSources(sources) {
    const list = document.createElement("div");
    list.className = "detail-list";

    sources.filter(hasDisplayValue).forEach((source) => {
        const row = document.createElement("div");
        row.className = "detail-list-row";

        if (source.sourceUrl) {
            row.appendChild(createLinkValue(source.sourceUrl, source.sourceName || source.sourceUrl));
        } else if (source.sourceName) {
            row.appendChild(createStrongValue(source.sourceName));
        }

        if (source.sourceGuid) {
            const guid = document.createElement("small");
            guid.textContent = source.sourceGuid;
            row.appendChild(guid);
        }

        list.appendChild(row);
    });

    return list.childElementCount ? list : null;
}

function createStrongValue(text) {
    const value = document.createElement("strong");
    value.textContent = text;
    return value;
}

function createLinkValue(url, text) {
    const value = document.createElement("a");
    value.href = url;
    value.target = "_blank";
    value.rel = "noopener noreferrer";
    value.textContent = text;
    return value;
}

function createPreValue(text) {
    const value = document.createElement("pre");
    value.textContent = text;
    return value;
}

function hasDisplayValue(value) {
    if (value === null || value === undefined || value === "") {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    if (typeof value === "object") {
        return Object.keys(value).length > 0;
    }

    return true;
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
        return new Intl.NumberFormat(displayLocale, {
            style: "currency",
            currency: price.currency || "EUR",
            maximumFractionDigits: 0,
        }).format(price.amount);
    } catch {
        return `${formatNumber(price.amount, { maximumFractionDigits: 0 })} ${price.currency || ""}`.trim();
    }
}

function formatSquareMeters(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const numericValue = Number(value);
    const formattedValue = Number.isFinite(numericValue)
        ? formatNumber(numericValue, { maximumFractionDigits: 2 })
        : String(value);

    return `${formattedValue} m\u00b2`;
}

function formatNumber(value, options = {}) {
    return new Intl.NumberFormat(displayLocale, options).format(value);
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

function toTitleLabel(value) {
    return String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
