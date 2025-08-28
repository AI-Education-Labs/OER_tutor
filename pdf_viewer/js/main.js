const url = "./docs/Research-Methods-in-Psychology_repaired.pdf";

let pdfDoc = null,
    pageNum = 1,
    pageIsRendering = false,
    pageNumIsPending = null;

const scale = 1.5,
    canvas = document.querySelector("#pdf-render"),
    ctx = canvas.getContext("2d");

// Render the page
const renderPage = num => {
    pageIsRendering = true;

    // Get page
    pdfDoc.getPage(num).then(page => {
        // Set scale and viewport
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page into canvas context
        const renderCtx = {
            canvasContext: ctx,
            viewport: viewport
        };
        page.render(renderCtx).promise.then(() => {
            pageIsRendering = false;

            if (pageNumIsPending !== null) {
                renderPage(pageNumIsPending);
                pageNumIsPending = null;
            }
        });

        // Update page counters
        document.querySelector("#page-num").textContent = num;
    });

}

// Get Document
pdfjsLib.getDocument(url).promise.then(pdfDoc_ => {
    pdfDoc = pdfDoc_;
    document.querySelector("#page-count").textContent = pdfDoc.numPages;

    // Initial/first page rendering
    renderPage(pageNum);
});