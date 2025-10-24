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

  const defaults = application.entityDefaults ?? {};

    const catalogs = application.config.entities.map((entity) => ({
      code: entity.code,
      name: entity.name,
      kind: entity.kind,
      href: `/api/entities/${entity.code}`,
      fields: entity.fields.map((field) => ({
        code: field.code,
        name: field.name,
        type: field.type,
        required: Boolean(field.required)
      })),
      defaults: defaults[entity.code]
        ? {
            listForm: defaults[entity.code].list.formCode,
            itemForm: defaults[entity.code].item.formCode,
            generatedList: defaults[entity.code].list.generated,
            generatedItem: defaults[entity.code].item.generated
          }
        : undefined
    }));

    const documents = application.manifest.map((form) => ({
      code: form.code,
      name: form.name,
      href: `/forms/${form.code}`,
      groups: form.groups,
      primaryEntity: form.primaryEntity,
      usage: form.usage ?? []
    }));

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
      applications: [
        {
          ...overview,
          sidebar: application.sidebar
        }
      ]
    };
  };

  fastify.get('/', overviewHandler);
  fastify.get('/api/overview', overviewHandler);

  fastify.get('/api/apps', async () => ({ applications: listApplications() }));
};

export default rootRoute;
