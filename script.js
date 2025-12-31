/*🔹 SECTION SWITCHING (SPA)*/
        function show(id) {
            $(".section").removeClass("active");
            $("#" + id).addClass("active");

            if (id === "reports") drawCharts();
            if (id === "dashboard") updateDashboard();
        }
        /*🔹 GLOBAL VARIABLES + LOCALSTORAGE INITIALIZATION*/
        let invoiceHistory = JSON.parse(localStorage.getItem("invoices") || "[]");
        let products = JSON.parse(localStorage.getItem("products") || "[]");
        let customers = JSON.parse(localStorage.getItem("customers") || "[]");
        /*🔹 DEFAULT ITEM ROW FOR INVOICE TABLE*/
        const defaultRow = () => `
<tr class="item-row">
    <td>
        <select class="form-select name">
            <option value="">-- Select Product --</option>
            ${products.map(p => `<option>${p.name}</option>`).join("")}
            <option value="custom">📝 Custom Item</option>
        </select>
        <input class="form-control customInput d-none" placeholder="Enter Custom Item">
    </td>
    <td><input class="form-control hsn"></td>
    <td>
        <select class="form-select gst">
            <option>0</option>
            <option>5</option>
            <option>12</option>
            <option selected>18</option>
            <option>28</option>
        </select>
    </td>
    <td><input type="number" class="form-control qty" value="1"></td>
    <td><input type="number" class="form-control rate" value="0"></td>
    <td class="amount">₹0.00</td>
    <td class="cgst">₹0.00</td>
    <td class="sgst">₹0.00</td>
    <td class="total fw-bold">₹0.00</td>
    <td class="remove text-danger fw-bold">✕</td>
</tr>`;
        /*🔹 ADD INITIAL ITEM ROW*/
        function initRow() {
            $("#items").append(defaultRow());
        }
        initRow();
        /*🔹 ITEM CHANGE → AUTO CALCULATE TOTALS*/
        $(document).on("input change", ".qty,.rate,.gst", updateTotals);
        $(document).on("click", ".remove", function () {
            $(this).closest(".item-row").remove();
            updateTotals();
        });
        /*🔹 PRODUCT SELECT → AUTO RATE FILL + CUSTOM*/
        $(document).on("change", ".name", function () {
            const row = $(this).closest("tr");
            const value = $(this).val();
            const customInput = row.find(".customInput");
            if (value === "custom") {
                customInput.removeClass("d-none");
                customInput.val("").focus();
                row.find(".rate").val("");
            } else {
                customInput.addClass("d-none");
                const prod = products.find(p => p.name === value);
                if (prod) {
                    row.find(".rate").val(prod.rate);
                }
            }
            updateTotals();
        });

        /*💰 CALCULATE SUMMARY TOTALS*/
        function updateTotals() {
            let a = 0,
                c = 0,
                s = 0,
                t = 0;
            $(".item-row").each(function () {
                let q = Number($(this).find(".qty").val());
                let r = Number($(this).find(".rate").val());
                let gst = Number($(this).find(".gst").val());
                let amt = q * r;
                let gstAmt = amt * gst / 100;
                let cg = gstAmt / 2;
                let sg = gstAmt / 2;
                let tot = amt + gstAmt;
                $(this).find(".amount").text("₹" + amt.toFixed(2));
                $(this).find(".cgst").text("₹" + cg.toFixed(2));
                $(this).find(".sgst").text("₹" + sg.toFixed(2));
                $(this).find(".total").text("₹" + tot.toFixed(2));
                a += amt;
                c += cg;
                s += sg;
                t += tot;
            });
            $("#amt").text(a.toFixed(2));
            $("#cgst").text(c.toFixed(2));
            $("#sgst").text(s.toFixed(2));
            $("#grand").text(t.toFixed(2));
        }

        /*💾 SAVE INVOICE → LOCAL STORAGE*/
        $("#saveInvoice").click(() => {
            if (!$("#invoiceNo").val() || !$("#buyerName").val()) {
                return alert("Invoice No & Customer are required!");
            }
            let itemsArr = [];
            $(".item-row").each(function () {
                const prodName = $(this).find(".name").val() === "custom" ?
                    $(this).find(".customInput").val() :
                    $(this).find(".name").val();
                itemsArr.push({
                    name: prodName,
                    hsn: $(this).find(".hsn").val(),
                    gst: $(this).find(".gst").val(),
                    qty: $(this).find(".qty").val(),
                    rate: $(this).find(".rate").val()
                });
            });
            invoiceHistory.push({
                invoiceNo: $("#invoiceNo").val(),
                date: $("#invoiceDate").val(),
                customer: $("#buyerName").val(),
                amount: $("#amt").text(),
                cgst: $("#cgst").text(),
                sgst: $("#sgst").text(),
                total: $("#grand").text(),
                items: itemsArr
            });
            localStorage.setItem("invoices", JSON.stringify(invoiceHistory));
            updateInvoiceHistory();
            updateDashboard();
            updateRecentInvoices();
            drawCharts();
            clearInvoiceFields();
            alert("Invoice Saved!");
        });

        /*🧹 CLEAR CURRENT INVOICE FORM*/
        function clearInvoiceFields() {
            $("#invoiceNo,#invoiceDate,#buyerGST,#buyerAddr,#buyerContact,#sellerName,#sellerGST,#sellerAddr,#sellerContact")
                .val("");
            $("#items").html("");
            initRow();
            updateTotals();
        }
        /*📑 UPDATE REPORTS TABLE*/
        function updateInvoiceHistory() {
            let tbody = $("#invoiceHistory");
            tbody.empty();
            if (!invoiceHistory.length) {
                tbody.html(`<tr><td colspan="8" class="text-muted">No Data</td></tr>`);
                return;
            }
            invoiceHistory.forEach((inv, i) => {
                tbody.append(`
        <tr>
            <td>${inv.invoiceNo}</td>
            <td>${inv.date}</td>
            <td>${inv.customer}</td>
            <td>${inv.amount}</td>
            <td>${inv.cgst}</td>
            <td>${inv.sgst}</td>
            <td>${inv.total}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="editInvoice(${i})">✎</button>
                <button class="btn btn-danger btn-sm" onclick="deleteInvoice(${i})">🗑</button>
            </td>
        </tr>`);
            });
        }
        /*✏ EDIT INVOICE → LOAD BACK TO FORM*/
        function editInvoice(i) {
            let inv = invoiceHistory[i];
            show("invoice");
            $("#invoiceNo").val(inv.invoiceNo);
            $("#invoiceDate").val(inv.date);
            $("#buyerName").val(inv.customer);
            $("#items").html("");
            inv.items.forEach(it => {
                initRow();
                let r = $("#items .item-row:last");
                // Match product dropdown if exists, else custom field
                if (products.some(p => p.name === it.name)) {
                    r.find(".name").val(it.name).change();
                } else {
                    r.find(".name").val("custom").change();
                    r.find(".customInput").val(it.name);
                }
                r.find(".hsn").val(it.hsn);
                r.find(".gst").val(it.gst);
                r.find(".qty").val(it.qty);
                r.find(".rate").val(it.rate);
            });
            updateTotals();
        }
        /*🗑 DELETE INVOICE*/
        function deleteInvoice(i) {
            if (!confirm("Delete this invoice?")) return;
            invoiceHistory.splice(i, 1);
            localStorage.setItem("invoices", JSON.stringify(invoiceHistory));
            updateInvoiceHistory();
            updateDashboard();
        }
        /*📊 UPDATE DASHBOARD CONTENT*/
        function updateDashboard() {
            let totalSales = invoiceHistory.reduce((s, i) => s + Number(i.total), 0);
            let totalGST = invoiceHistory.reduce((s, i) => s + Number(i.cgst) + Number(i.sgst), 0);
            $("#dashInv").text(invoiceHistory.length);
            $("#dashSales").text(totalSales.toFixed(2));
            $("#dashGST").text(totalGST.toFixed(2));
            $("#dashAvg").text((totalSales / 12).toFixed(2));
            updateRecentInvoices();
        }
        /*⭐ Show last 5 invoices on Dashboard*/
        function updateRecentInvoices() {
            let tbody = $("#recentInvoices");
            tbody.empty();
            let lastFive = invoiceHistory.slice(-5).reverse();
            if (!lastFive.length) {
                tbody.html(`<tr><td colspan="4">No invoices yet</td></tr>`);
                return;
            }
            lastFive.forEach(inv => {
                tbody.append(`
        <tr>
            <td>${inv.invoiceNo}</td>
            <td>${inv.date}</td>
            <td>${inv.customer}</td>
            <td>${inv.total}</td>
        </tr>`);
            });
        }
        /*📊 CHARTS USING Chart.js*/
        let pieChart, barChart, lineChart;
        function drawCharts() {
            if (!invoiceHistory.length) return;
            let totalSales = invoiceHistory.reduce((s, x) => s + Number(x.total), 0);
            let totalGST = invoiceHistory.reduce((s, x) => s + Number(x.cgst) + Number(x.sgst), 0);
            let months = Array(12).fill(0);
            invoiceHistory.forEach(x => {
                let m = new Date(x.date).getMonth();
                if (!isNaN(m)) months[m] += Number(x.total);
            });
            // Destroy old charts to avoid overlay
            if (pieChart) pieChart.destroy();
            if (barChart) barChart.destroy();
            if (lineChart) lineChart.destroy();
            pieChart = new Chart(document.getElementById("pieChart"), {
                type: "pie",
                data: {
                    labels: ["Sales", "GST"],
                    datasets: [{
                        data: [totalSales, totalGST]
                    }]
                }
            });
            barChart = new Chart(document.getElementById("barChart"), {
                type: "bar",
                data: {
                    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
                        "Dec"],
                    datasets: [{
                        label: "Sales (₹)",
                        data: months
                    }]
                }
            });
            lineChart = new Chart(document.getElementById("lineChart"), {
                type: "line",
                data: {
                    labels: months.map((_, i) => "M" + (i + 1)),
                    datasets: [{
                        label: "GST Trend",
                        data: months.map(x => x * 0.18)
                    }]
                }
            });
        }

        /*📝 PDF EXPORT — jsPDF*/
        function previewInvoice() {
            window.print();
        }
        function downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("p", "mm", "a4");
        const seller = {
        name: $("#sellerName").val() || "XYZ Enterprises",
        gst: $("#sellerGST").val() || "27ABCDE1234F1Z5",
        addr: $("#sellerAddr").val() || "Pune",
        contact: $("#sellerContact").val() || "xyz.business@gmail.com",
        bank: "SBI",
        account: "44094217890"
        };
        const buyer = {
        name: $("#buyerName option:selected").text(),
        gst: $("#buyerGST").val() || "-",
        addr: $("#buyerAddr").val() || "-",
        contact: $("#buyerContact").val() || "-"
        };
        let invoiceNo = $("#invoiceNo").val();
        let invoiceDate = $("#invoiceDate").val();
        let y = 10;
        // Header Title
        doc.setFontSize(14);
        doc.text("TAX INVOICE", 105, y, { align: "center" });
        y += 8;
        // Seller Details
        doc.setFontSize(11);
        doc.text(`${seller.name}`, 10, y);
        y += 6;
        doc.text(`GSTIN: ${seller.gst}`, 10, y);
        y += 6;
        doc.text(`Address: ${seller.addr}`, 10, y);
        y += 6;
        doc.text(`Contact: ${seller.contact}`, 10, y);
        y += 10;
        // Invoice Details
        doc.text(`Invoice No: ${invoiceNo}`, 140, 20);
        doc.text(`Date: ${invoiceDate}`, 140, 26);
        // Buyer Section
        doc.text("Billed To:", 10, y);
        y += 6;
        doc.text(`Name: ${buyer.name}`, 10, y);
        y += 6;
        doc.text(`GSTIN: ${buyer.gst}`, 10, y);
        y += 6;
        doc.text(`Address: ${buyer.addr}`, 10, y);
        y += 6;
        doc.text(`Contact: ${buyer.contact}`, 10, y);
        y += 8;
        // Table Headers
        doc.setFontSize(10);
        doc.line(10, y, 200, y);
        y += 5;
        doc.text("Item", 12, y);
        doc.text("HSN", 60, y);
        doc.text("Qty", 90, y);
        doc.text("Rate", 110, y);
        doc.text("GST%", 130, y);
        doc.text("CGST", 150, y);
        doc.text("SGST", 170, y);
        doc.text("Total", 190, y, { align: "right" });
        y += 3;
        doc.line(10, y, 200, y);
        y += 6;
        // Collect Totals
        let totalAmt = 0, totalCGST = 0, totalSGST = 0, grandTotal = 0;
        $(".item-row").each(function () {
        let name = $(this).find(".name").val();
        let hsn = $(this).find(".hsn").val() || "-";
        let qty = $(this).find(".qty").val();
        let rate = $(this).find(".rate").val();
        let gst = $(this).find(".gst").val();
        let amt = qty * rate;
        let gstAmt = amt * gst / 100;
        let cgstAmt = gstAmt / 2;
        let sgstAmt = gstAmt / 2;
        let t = amt + gstAmt;
        // Print row
        doc.text(name, 12, y);
        doc.text(String(hsn), 60, y);
        doc.text(String(qty), 95, y);
        doc.text(`₹${rate}`, 110, y);
        doc.text(`${gst}%`, 132, y);
        doc.text(`₹${cgstAmt.toFixed(2)}`, 150, y);
        doc.text(`₹${sgstAmt.toFixed(2)}`, 170, y);
        doc.text(`₹${t.toFixed(2)}`, 200, y, { align: "right" });
        y += 6;
        totalAmt += amt;
        totalCGST += cgstAmt;
        totalSGST += sgstAmt;
        grandTotal += t;
        });
        y += 4;
        doc.line(10, y, 200, y);
        y += 8;
        // Totals
        doc.text(`Subtotal: ₹${totalAmt.toFixed(2)}`, 140, y);
        y += 6;
        doc.text(`CGST: ₹${totalCGST.toFixed(2)}`, 140, y);
        y += 6;
        doc.text(`SGST: ₹${totalSGST.toFixed(2)}`, 140, y);
        y += 6;
        doc.text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 140, y);
        y += 10;
        // Declaration + Sign Box
        doc.setFontSize(9);
        doc.text("DECLARATION:", 10, y);
        y += 5;
        doc.text("We declare that this invoice shows the actual price of the goods/services", 10, y);
        y += 5;
        doc.text("and that all particulars are true and correct.", 10, y);
        y += 15;
        doc.text("For XYZ Enterprises", 140, y);
        y += 20;
        doc.text("Authorized Signatory", 150, y);
        doc.save(`Invoice_${invoiceNo}.pdf`);
        }
        /*📤 CSV EXPORT — Full History*/
        function exportFullHistory() {
            if (!invoiceHistory.length) return alert("No data to export!");
            let csv = "Invoice No,Date,Customer,Amount,CGST,SGST,Total\n";
            invoiceHistory.forEach(i => {
                csv += `${i.invoiceNo},${i.date},${i.customer},${i.amount},${i.cgst},${i.sgst},${i.total}\n`;
            });
            let blob = new Blob([csv], {
                type: "text/csv"
            });
            let a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "Invoice_History.csv";
            a.click();
        }
        function exportCSV() {
        if ($(".item-row").length === 0)
        return alert("Add at least one item before exporting!");
        let csv = "Item,HSN,GST%,Qty,Rate,Amount,CGST,SGST,Total\n";
        $(".item-row").each(function () {
        let name = $(this).find(".name").val() === "custom"
        ? $(this).find(".customInput").val()
        : $(this).find(".name").val();
        csv += [
        `"${name}"`,
        $(this).find(".hsn").val(),
        $(this).find(".gst").val(),
        $(this).find(".qty").val(),
        $(this).find(".rate").val(),
        $(this).find(".amount").text().replace("₹", ""),
        $(this).find(".cgst").text().replace("₹", ""),
        $(this).find(".sgst").text().replace("₹", ""),
        $(this).find(".total").text().replace("₹", "")
        ].join(",") + "\n";
        });
        let blob = new Blob([csv], { type: "text/csv" });
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Invoice_${$("#invoiceNo").val() || "Data"}.csv`;
        a.click();
        }
        /*🧩 MASTER — PRODUCTS*/
        function addProduct() {
            let name = $("#newProd").val();
            let rate = $("#newRate").val();
            if (!name || !rate) return alert("Fill product details!");
            products.push({
                name,
                rate
            });
            localStorage.setItem("products", JSON.stringify(products));
            loadMasters();
            $("#newProd,#newRate").val("");
        }
        function deleteProduct(i) {
            products.splice(i, 1);
            localStorage.setItem("products", JSON.stringify(products));
            loadMasters();
        }
        /*🧩 MASTER — CUSTOMERS*/
        function addCustomer() {
        let cust = {
        name: $("#custName").val(),
        gst: $("#custGST").val(),
        addr: $("#custAddr").val(),
        contact: $("#custContact").val()
        };
        if (!cust.name) return alert("Customer name required!");
        customers.push(cust);
        localStorage.setItem("customers", JSON.stringify(customers));
        $("#custName,#custGST,#custAddr,#custContact").val("");
        loadMasters();
        }
        function deleteCustomer(i) {
            customers.splice(i, 1);
            localStorage.setItem("customers", JSON.stringify(customers));
            loadMasters();
        }
        /*🔁 Refresh Masters UI + Dropdowns*/
        function loadMasters() {
        // Customer List UI
        $("#custList").html(customers.map((c, i) => `
        <li class="list-group-item">
            <strong>${c.name}</strong><br>
            GST: ${c.gst || "-"}<br>
            Addr: ${c.addr || "-"}<br>
            Contact: ${c.contact || "-"}
            <button class="btn btn-danger btn-sm float-end" onclick="deleteCustomer(${i})">✕</button>
        </li>
        `).join(""));
        // Product List UI
        $("#prodList").html(products.map((p, i) => `
        <li class="list-group-item d-flex justify-content-between">
            ${p.name} — ₹${p.rate}
            <button class="btn btn-danger btn-sm" onclick="deleteProduct(${i})">✕</button>
        </li>
        `).join(""));
        // Dropdown update
        $("#buyerName").html(
        `<option value="">-- Select Customer --</option>` +
        customers.map((c, i) => `<option value="${i}">${c.name}</option>`).join("") +
        `<option value="manual">Other (Manual)</option>`
        );
        }
        /*🧨 RESET ALL SYSTEM DATA*/
        function clearAllData() {
            if (!confirm("This will delete all data! Continue?")) return;
            localStorage.clear();
            location.reload();
        }
        // Load data on page start
        document.addEventListener("DOMContentLoaded", () => {
        loadMasters();
        // 🔹 FIX: Add item button
        $("#addLine").click(() => {
        initRow();
        updateTotals();
        });
        $("#buyerName").on("change", function () {
        let val = $(this).val();
        if (val === "manual" || val === "") {
        $("#buyerGST,#buyerAddr,#buyerContact").val("");
        return;
        }
        let c = customers[val];
        $("#buyerGST").val(c.gst);
        $("#buyerAddr").val(c.addr);
        $("#buyerContact").val(c.contact);
        });
        updateInvoiceHistory();
        updateDashboard();
        drawCharts();
        setDefaultSeller();
        });
        // 🔹 Default Business (Seller) Details
        function setDefaultSeller() {
        $("#sellerName").val("XYZ Enterprises");
        $("#sellerGST").val("27ABCDE1234F1Z5");
        $("#sellerAddr").val("Pune");
        $("#sellerContact").val("xyz.business@gmail.com");
        }
