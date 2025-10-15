import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { FormRenderer } from './components/FormRenderer.js';
import { Layout } from './components/Layout.js';
import { TableView } from './components/TableView.js';
import { useAmadin } from './context/AmadinContext.js';
import { useSession } from './hooks/useSession.js';
export function App() {
    const { currentApp, loading, applications, selectApp } = useAmadin();
    const { session, login, logout } = useSession();
    useEffect(() => {
        if (!currentApp && applications[0]) {
            void selectApp(applications[0].id);
        }
    }, [applications, currentApp, selectApp]);
    return (_jsxs(Layout, { children: [_jsxs("section", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { children: [_jsx("h2", { children: currentApp?.meta.name ?? 'Оберіть застосунок' }), _jsx("p", { children: "\u0426\u0435 \u0434\u0435\u043C\u043E \u0456\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0443 Amadin. \u041C\u0438 \u0440\u0435\u043D\u0434\u0435\u0440\u0438\u043C\u043E UI \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0456 \u043A\u043E\u043D\u0444\u0456\u0433\u0443\u0440\u0430\u0446\u0456\u0457." })] }), _jsx("div", { children: session.sessionId ? (_jsxs("button", { onClick: () => logout(), children: ["\u0412\u0438\u0439\u0442\u0438 (", session.username, ")"] })) : (_jsx("button", { onClick: () => login('demo-user'), children: "\u0423\u0432\u0456\u0439\u0442\u0438 \u044F\u043A demo-user" })) })] }), loading && _jsx("p", { children: "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F..." }), currentApp ? (_jsxs("div", { style: { display: 'grid', gap: '2rem' }, children: [_jsx(FormRenderer, { app: currentApp }), currentApp.manifest[0]?.layout[0]?.entity ? (_jsx(TableView, { appId: currentApp.meta.id, entityCode: currentApp.manifest[0]?.layout[0]?.entity ?? '' })) : (_jsx("p", { children: "\u0414\u043E\u0434\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u043D\u0430\u0439\u043C\u043D\u0456 \u043E\u0434\u043D\u0435 \u043F\u043E\u043B\u0435 \u0437 \u043F\u0440\u0438\u0432'\u044F\u0437\u043A\u043E\u044E \u0434\u043E \u0441\u0443\u0442\u043D\u043E\u0441\u0442\u0456, \u0449\u043E\u0431 \u043F\u043E\u0431\u0430\u0447\u0438\u0442\u0438 \u0442\u0430\u0431\u043B\u0438\u0447\u043D\u0456 \u0434\u0430\u043D\u0456." }))] })) : (!loading && _jsx("p", { children: "\u041D\u0435\u043C\u0430\u0454 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0445 \u043A\u043E\u043D\u0444\u0456\u0433\u0443\u0440\u0430\u0446\u0456\u0439." }))] }));
}
