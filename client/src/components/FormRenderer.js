import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { fetchEntityRows } from '../api/index.js';
export function FormRenderer({ app }) {
    const primaryForm = app.manifest[0];
    const [rows, setRows] = useState([]);
    useEffect(() => {
        const entityCode = primaryForm?.layout[0]?.entity;
        if (!primaryForm || !entityCode) {
            setRows([]);
            return;
        }
        fetchEntityRows(app.meta.id, entityCode)
            .then(setRows)
            .catch((error) => {
            console.error('Failed to load entity rows', error);
        });
    }, [app, primaryForm]);
    if (!primaryForm) {
        return _jsx("p", { children: "\u0416\u043E\u0434\u043D\u043E\u0457 \u0444\u043E\u0440\u043C\u0438 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \uD83E\uDD37\u200D\u2640\uFE0F" });
    }
    return (_jsxs("section", { children: [_jsxs("header", { children: [_jsx("h2", { children: primaryForm.name }), _jsx("p", { children: "\u0429\u043E\u0431 \u043F\u043E\u0431\u0430\u0447\u0438\u0442\u0438 \u0444\u043E\u0440\u043C\u0443, \u0432\u0456\u0434\u0440\u0435\u0434\u0430\u0433\u0443\u0439\u0442\u0435 `examples/demo-config.json`." })] }), _jsx("div", { style: { display: 'grid', gap: '1rem', maxWidth: 480 }, children: primaryForm.layout.map((field) => (_jsxs("label", { style: { display: 'flex', flexDirection: 'column', gap: '0.25rem' }, children: [_jsx("span", { children: field.label }), _jsx("input", { type: "text", placeholder: field.field })] }, field.field))) }), _jsx("pre", { style: { marginTop: '2rem', padding: '1rem', background: '#f5f5f5' }, children: JSON.stringify(rows, null, 2) })] }));
}
