export async function fetchApplications() {
    const response = await fetch('/api/apps');
    if (!response.ok) {
        throw new Error('Failed to fetch applications');
    }
    const json = await response.json();
    return json.applications;
}
export async function fetchApplication(appId) {
    const response = await fetch(`/app/${appId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch application');
    }
    return (await response.json());
}
export async function fetchEntityRows(appId, entityCode) {
    const response = await fetch(`/api/${appId}/entities/${entityCode}`);
    if (!response.ok) {
        throw new Error('Failed to fetch entity data');
    }
    const json = await response.json();
    return json.data;
}
