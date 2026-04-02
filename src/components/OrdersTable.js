import React, { useState, useMemo } from 'react';
import DataTable from './DataTable';
import { Search, Table2 } from 'lucide-react';

function OrdersTable({ ordersData, modalValues, selectedChannels }) {
    const [ordersSearch, setOrdersSearch] = useState('');

    const columns = [
        "Order ID", "Order Status", "Order Substatus", "Cancelation/Return Type", "Cancel Reason",
        "Normal or Pre-order", "SKU ID", "Seller SKU", "Product Name", "Variation",
        "Quantity", "SKU Unit Original Price", "SKU Subtotal Before Discount", "SKU Platform Discount",
        "SKU Seller Discount", "SKU Subtotal After Discount", "Shipping Fee After Discount",
        "Original Shipping Fee", "Shipping Fee Seller Discount", "Shipping Fee Platform Discount",
        "Taxes", "Order Amount", "Order Refund Amount", "Buyer Message", "Buyer Username",
        "Recipient", "Phone #", "Zipcode", "Province", "Regency and City", "District",
        "Detail Address", "Full Address", "Shipping Provider Name", "Tracking ID",
        "Delivery Option", "Large Goods Delivery Fee", "Weight(kg)", "Dimensions",
        "Is Replacement Order", "Is On Hold Order", "Created Time", "Paid Time",
        "RTS Time", "Shipped Time", "Delivered Time", "Cancelled Time",
        "Cancel By", "Fulfillment Type", "Warehouse Name", "Collection Time",
        "Seller Note", "Package ID", "Payment Method", "Pickup/Drop Off/Self Fulfillment",
        "Direct Shipping Fee (IDR)", "Shipping Fee Reverse (IDR)", "Replacement Order for",
        "Line Discount (Financed by Platform)", "Line Discount (Financed by Seller)",
        "Line Discount (Financed by 3PL)", "Small Order Fee", "Modal",
    ];

    const filteredOrders = useMemo(() => {
        let result = ordersData;
        if (selectedChannels && selectedChannels.length > 0) {
            result = result.filter(
                (row) => selectedChannels.includes(row["Channel Marketplace"])
            );
        }
        if (ordersSearch.trim()) {
            const s = ordersSearch.toLowerCase();
            result = result.filter((row) =>
                Object.values(row).some(
                    (val) => val && val.toString().toLowerCase().includes(s)
                )
            );
        }
        return result;
    }, [ordersData, selectedChannels, ordersSearch]);

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Table2 size={24} style={{ color: '#7c3aed' }} />
                        Tabel Pesanan
                    </h2>
                    <p>{filteredOrders.length.toLocaleString('id-ID')} pesanan</p>
                </div>
                <div style={{ position: 'relative', maxWidth: '20rem', flex: '1' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        placeholder="Cari pesanan..."
                        value={ordersSearch}
                        onChange={(e) => setOrdersSearch(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <DataTable columns={columns} data={filteredOrders}>
                {(row) => {
                    const orderStatus = (row["Order Status"] || "").toString().toLowerCase();
                    if (orderStatus === "canceled" || orderStatus === "cancelled") {
                        return columns.map((col) => (
                            <td key={col} title={col === "Modal" ? "CANCEL" : row[col]}
                                style={{
                                    padding: '0.625rem 1rem',
                                    color: col === "Modal" ? '#f87171' : 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '200px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: '0.8125rem',
                                    fontWeight: col === "Modal" ? 600 : 400,
                                }}>
                                {col === "Modal" ? "CANCEL" : row[col]}
                            </td>
                        ));
                    }
                    return columns.map((col) => {
                        let displayVal = row[col];
                        if (col === "Modal") {
                            const sellerSku = (row["Seller SKU"] || "").toString().trim();
                            const skuId = (row["SKU ID"] || "").toString().trim();
                            const variation = (row["Variation"] || "").toString().trim();
                            const quantity = parseInt(row["Quantity"]) || 0;
                            const variationKey = sellerSku + "||" + skuId + "||" + variation;
                            let modalSource = modalValues[variationKey] || modalValues[sellerSku] || "";
                            if (modalSource) {
                                const numericValue = parseInt(modalSource.replace(/[^0-9]/g, "")) || 0;
                                displayVal = "Rp" + (numericValue * quantity).toLocaleString("id-ID");
                            } else {
                                displayVal = "Belum Diinput";
                            }
                        }
                        return (
                            <td key={col} title={displayVal}
                                style={{
                                    padding: '0.625rem 1rem',
                                    color: col === "Modal" && displayVal === "Belum Diinput" ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '200px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: '0.8125rem',
                                    fontStyle: col === "Modal" && displayVal === "Belum Diinput" ? 'italic' : 'normal',
                                }}>
                                {displayVal}
                            </td>
                        );
                    });
                }}
            </DataTable>
        </div>
    );
}

export default OrdersTable;