import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAmadin } from '../context/AmadinContext.js';
export function Layout({ children }) {
    const { applications, selectApp, currentApp } = useAmadin();
    return (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', fontFamily: 'sans-serif' }, children: [_jsxs("aside", { style: { borderRight: '1px solid #eee', padding: '1rem' }, children: [_jsx("h1", { style: { marginTop: 0 }, children: "Amadin" }), _jsx("ul", { style: { listStyle: 'none', padding: 0, margin: 0 }, children: applications.map((app) => (_jsx("li", { children: _jsx("button", { style: {
                                    border: 'none',
                                    background: currentApp?.meta.id === app.id ? '#111' : '#f5f5f5',
                                    color: currentApp?.meta.id === app.id ? '#fff' : '#333',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    width: '100%',
                                    textAlign: 'left',
                                    marginBottom: '0.5rem'
                                }, onClick: () => selectApp(app.id), children: app.name }) }, app.id))) })] }), _jsx("main", { style: { padding: '2rem' }, children: children })] }));
}
