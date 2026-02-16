# Shared Album Setup (Google Drive + Apps Script)

This setup keeps uploads no-login for guests and stores everything in your Google Drive.
The wedding website uses:
- An upload link (Apps Script web app URL, used inside an iframe)
- A gallery JSON link (same URL with `?action=gallery`)

## 1) Create the Drive folder
1. Create a folder in Google Drive (example: "Wedding Guest Photos").
2. Copy the folder ID from the URL.

## 2) Create the Apps Script
1. Go to https://script.google.com and create a new project.
2. Replace the default code with the script below.
3. Update `UPLOAD_FOLDER_ID` with your folder ID.

```javascript
const UPLOAD_FOLDER_ID = "REPLACE_WITH_FOLDER_ID";
const MAX_FILES = 10;
const MAX_GALLERY_ITEMS = 120;

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || "").toLowerCase();
  if (action === "gallery") {
    return galleryJson_();
  }
  return uploadPage_();
}

function uploadPage_() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload Wedding Photos</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; background: #f7f6f4; color: #2b2b2b; }
    h1 { margin: 0 0 8px; }
    p { margin: 0 0 16px; line-height: 1.5; }
    .card { background: #fff; border: 1px solid #e7e0e0; border-radius: 12px; padding: 18px; }
    .btn { margin-top: 12px; padding: 10px 16px; border: none; border-radius: 999px; background: #8fae9b; color: #fff; font-weight: 600; cursor: pointer; }
    .status { margin-top: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Upload Wedding Photos</h1>
    <p>Please share up to ${MAX_FILES} photos. Thank you for capturing the day with us!</p>
    <form id="upload-form">
      <input id="photos" type="file" accept="image/*" multiple>
      <br>
      <button class="btn" type="submit">Upload</button>
    </form>
    <p class="status" id="status"></p>
  </div>

  <script>
    const form = document.getElementById("upload-form");
    const input = document.getElementById("photos");
    const statusEl = document.getElementById("status");

    function readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          const base64 = dataUrl.split(",")[1] || "";
          resolve({
            name: file.name,
            mimeType: file.type || "image/jpeg",
            data: base64
          });
        };
        reader.onerror = () => reject(reader.error || new Error("Read failed"));
        reader.readAsDataURL(file);
      });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const files = Array.from(input.files || []).slice(0, ${MAX_FILES});
      if (!files.length) {
        statusEl.textContent = "Please choose photo files to upload.";
        return;
      }

      statusEl.textContent = "Uploading...";

      Promise.all(files.map(readFile))
        .then((payload) => {
          google.script.run
            .withSuccessHandler((result) => {
              statusEl.textContent = "Uploaded " + result.count + " photo(s). Thank you!";
              form.reset();
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: "album:uploaded" }, "*");
              }
            })
            .withFailureHandler((error) => {
              statusEl.textContent = (error && error.message) || "Upload failed.";
            })
            .uploadFiles({ files: payload });
        })
        .catch(() => {
          statusEl.textContent = "Unable to read your files.";
        });
    });
  </script>
</body>
</html>
  `);

  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function uploadFiles(payload) {
  const files = (payload && payload.files) || [];
  if (!files.length) throw new Error("No files received.");

  const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const results = [];

  files.slice(0, MAX_FILES).forEach((file) => {
    const bytes = Utilities.base64Decode(file.data);
    const blob = Utilities.newBlob(bytes, file.mimeType, file.name);
    const created = folder.createFile(blob);
    created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    results.push(created.getId());
  });

  return { ok: true, count: results.length };
}

function galleryJson_() {
  const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const files = folder.getFiles();
  const items = [];

  while (files.hasNext()) {
    const file = files.next();
    const mime = file.getMimeType();
    if (!mime.startsWith("image/")) continue;
    items.push({
      id: file.getId(),
      name: file.getName(),
      created: file.getDateCreated().getTime()
    });
  }

  items.sort((a, b) => b.created - a.created);

  const trimmed = items.slice(0, MAX_GALLERY_ITEMS).map((item) => ({
    url: `https://drive.google.com/uc?export=view&id=${item.id}`,
    thumb: `https://drive.google.com/thumbnail?id=${item.id}&sz=w800`,
    caption: item.name
  }));

  return ContentService
    .createTextOutput(JSON.stringify({ items: trimmed }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3) Deploy the Apps Script
1. Click **Deploy** -> **New deployment**.
2. Select **Web app**.
3. Set **Execute as**: Me.
4. Set **Who has access**: Anyone.
5. Copy the web app URL.

## 4) Connect the wedding website
1. Open `shared-album.html` and set:
   - `data-upload-url` to the web app URL.
   - `data-gallery-url` to the web app URL + `?action=gallery`.
2. Generate a QR code for the `shared-album.html` page URL (not the Apps Script URL).
3. Replace the QR placeholder in `shared-album.html` or add an image and update the markup.

## Notes
- The gallery shows the newest items first.
- You can adjust `MAX_GALLERY_ITEMS` to limit how many show on the page.
- If you want to fully hide file names, replace `caption: item.name` with an empty string.
