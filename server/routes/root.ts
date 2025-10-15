import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { getApplication, listApplications } from '../services/dbRegistry.js';

const rootRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/', async () => {
    const apps = listApplications();

    const overview = apps.map(({ id, name }) => {
      const application = getApplication(id);

      if (!application) {
        return {
          id,
          name,
          summary: { catalogCount: 0, documentCount: 0 },
          links: {
            manifest: `/app/${id}`,
            catalogs: [],
            documents: []
          }
        };
      }

      const catalogs = application.config.entities.map((entity) => ({
        code: entity.code,
        name: entity.name,
        href: `/api/${id}/entities/${entity.code}`,
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
          href: `/app/${id}/forms/${form.code}`,
          layout: manifestEntry?.layout ?? []
        };
      });

      return {
        id,
        name,
        summary: {
          catalogCount: catalogs.length,
          documentCount: documents.length
        },
        links: {
          manifest: `/app/${id}`,
          catalogs,
          documents
        },
        metadata: {
          manifest: application.manifest
        }
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      applications: overview
    };
  });

  fastify.get('/api/apps', async () => ({ applications: listApplications() }));
};

export default rootRoute;
