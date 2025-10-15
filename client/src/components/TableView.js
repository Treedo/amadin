import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { fetchEntityRows } from '../api/index.js';
export function TableView({ appId, entityCode }) {
    const [rows, setRows] = useState([]);
    useEffect(() => {
        fetchEntityRows(appId, entityCode)
            .then(setRows)
            .catch((error) => console.error(error));
    }, [appId, entityCode]);
    return (_jsx("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: _jsx("tbody", { children: rows.map((row, index) => (_jsx("tr", { children: _jsx("td", { style: { border: '1px solid #ddd', padding: '0.5rem' }, children: _jsx("pre", { style: { margin: 0 }, children: JSON.stringify(row, null, 2) }) }) }, index))) }) }));
}
