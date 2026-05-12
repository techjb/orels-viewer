let ajvLoadError = null;

try {
    importScripts("https://cdn.jsdelivr.net/npm/ajv@6.12.6/dist/ajv.bundle.min.js");
} catch (error) {
    ajvLoadError = error;
}

const displayLocale = "es-ES";
const maxReportedErrors = 1000;

self.onmessage = async (event) => {
    const message = event.data;

    if (!message || message.type !== "process") {
        return;
    }

    try {
        const result = await processFile(message.file, message.schema, message.schemaVersion);
        self.postMessage({ type: "result", ...result });
    } catch (error) {
        self.postMessage({
            type: "error",
            message: error?.message || "The file could not be processed.",
        });
    }
};

async function processFile(file, schema, schemaVersion) {
    if (ajvLoadError) {
        throw new Error(`AJV could not load in the import worker: ${ajvLoadError.message}`);
    }

    postProgress("Reading file", file, "Reading JSON file...", 0);
    const rawText = await readFileText(file);

    postProgress("Parsing JSON", file, "Parsing JSON outside the main page...", 38, true);
    await yieldToWorker();

    let json;
    try {
        json = JSON.parse(rawText);
    } catch (error) {
        return {
            isFileUsable: false,
            fileErrorCount: 1,
            fileErrors: [`The file could not be parsed as JSON: ${error.message}`],
        };
    }

    postProgress("Preparing validator", file, `Preparing ${schemaVersion} schema validation...`, 45);
    await yieldToWorker();

    const ajv = new Ajv({
        allErrors: true,
        jsonPointers: true,
        verbose: true,
    });
    configureAjvFormats(ajv);

    const validateFile = ajv.compile(createFileContainerSchema(schema));
    postProgress("Validating file", file, "Checking top-level ORELS structure...", 49);
    const isFileUsable = validateFile(json);

    if (!isFileUsable) {
        const errors = validateFile.errors || [];
        return {
            isFileUsable: false,
            fileErrorCount: errors.length,
            fileErrors: limitErrors(errors.map(formatValidationError)),
        };
    }

    const listingSchema = getListingSchema(schema);
    if (!listingSchema) {
        return {
            isFileUsable: false,
            fileErrorCount: 1,
            fileErrors: ["The selected schema does not expose a listing definition."],
        };
    }

    const validateListing = ajv.compile(listingSchema);
    const listings = Array.isArray(json.listings) ? json.listings : [];
    const rows = [];
    const listingErrors = [];
    let listingErrorCount = 0;

    for (let index = 0; index < listings.length; index += 1) {
        const listing = listings[index];
        const isListingValid = validateListing(listing);

        if (isListingValid) {
            rows.push(toTableRow(listing, index));
        } else {
            (validateListing.errors || []).forEach((error) => {
                listingErrorCount += 1;
                if (listingErrors.length < maxReportedErrors) {
                    listingErrors.push(formatListingValidationError(error, listing, index));
                }
            });
        }

        if (index % 250 === 0 || index === listings.length - 1) {
            const completed = listings.length ? index + 1 : 0;
            const percent = 50 + Math.round((completed / Math.max(listings.length, 1)) * 42);
            postProgress(
                "Validating listings",
                file,
                `${completed.toLocaleString(displayLocale)} of ${listings.length.toLocaleString(displayLocale)} listings checked.`,
                percent
            );
            await yieldToWorker();
        }
    }

    postProgress("Completing import", file, "Sending validated listings to the page...", 94);

    return {
        isFileUsable: true,
        rows,
        listingCount: listings.length,
        validListingCount: rows.length,
        listingErrorCount,
        listingErrors,
        summary: {
            listingCount: listings.length,
            created: json.created || "",
            schemaUrl: json.schemaUrl || schemaVersion,
        },
    };
}

function readFileText(file) {
    if (typeof FileReader !== "undefined") {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onprogress = (event) => {
                if (!event.lengthComputable) {
                    return;
                }

                const percent = Math.round((event.loaded / event.total) * 35);
                postProgress(
                    "Reading file",
                    file,
                    `${formatFileSize(event.loaded)} of ${formatFileSize(event.total)} read.`,
                    percent
                );
            };
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error || new Error("File reading failed."));
            reader.readAsText(file);
        });
    }

    return file.text();
}

function postProgress(stage, file, detail, percent, indeterminate = false) {
    self.postMessage({
        type: "progress",
        stage,
        fileName: file?.name || "",
        fileSize: file?.size || 0,
        detail,
        percent,
        indeterminate,
    });
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

function limitErrors(errors) {
    if (errors.length <= maxReportedErrors) {
        return errors;
    }

    return [
        ...errors.slice(0, maxReportedErrors),
        `${errors.length - maxReportedErrors} additional validation errors were not shown.`,
    ];
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

function formatNumber(value, options = {}) {
    return new Intl.NumberFormat(displayLocale, options).format(value);
}

function yieldToWorker() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
