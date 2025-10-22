import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { getApplication, getDefaultAppId, listApplications } from '../services/dbRegistry.js';

const rootRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const overviewHandler = async () => {
    const appId = getDefaultAppId();
    const application = appId ? getApplication(appId) : undefined;

    if (!application || !appId) {
      return {
        generatedAt: new Date().toISOString(),
        applications: []
      };
    }

    const catalogs = application.config.entities.map((entity) => ({
      code: entity.code,
      name: entity.name,
      href: `/api/entities/${entity.code}`,
      fields: entity.fields.map((field) => ({
        code: field.code,
        name: field.name,
        type: field.type,
        required: Boolean(field.required)
      }))
    }));

    const documents = application.config.forms.map((form) => {
      const manifestEntry = application.manifest.find((item) => item.code === form.code);
      return {
        code: form.code,
        name: form.name,
        href: `/forms/${form.code}`,
        groups: manifestEntry?.groups ?? [],
        primaryEntity: manifestEntry?.primaryEntity
      };
    });

    const overview = {
      id: appId,
      name: application.config.name,
      summary: {
        catalogCount: catalogs.length,
        documentCount: documents.length
      },
      links: {
        manifest: '/',
        catalogs,
        documents
      },
      metadata: {
        manifest: application.manifest
      }
    };

    return {
      generatedAt: new Date().toISOString(),
      applications: [overview]
    };
  };

  fastify.get('/', overviewHandler);
  fastify.get('/api/overview', overviewHandler);

  fastify.get('/api/apps', async () => ({ applications: listApplications() }));
};

export default rootRoute;
