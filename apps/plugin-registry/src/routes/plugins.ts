import express, { Router } from 'express';
import { getAllPlugins, getPluginById, searchPlugins, incrementDownloads } from '../db/index.js';
import { logger } from '../utils/logger.js';

export const pluginsRouter: Router = express.Router();

// GET /api/plugins - Get all plugins
pluginsRouter.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    const plugins = search 
      ? await searchPlugins(search as string)
      : await getAllPlugins();
    
    res.json({ success: true, data: plugins });
  } catch (error) {
    logger.error('Error fetching plugins', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plugins' });
  }
});

// GET /api/plugins/:id - Get plugin by ID
pluginsRouter.get('/:id', async (req, res) => {
  try {
    const plugin = await getPluginById(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ success: false, error: 'Plugin not found' });
    }
    
    res.json({ success: true, data: plugin });
  } catch (error) {
    logger.error('Error fetching plugin', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plugin' });
  }
});

// POST /api/plugins/:id/download - Increment download count
pluginsRouter.post('/:id/download', async (req, res) => {
  try {
    await incrementDownloads(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error incrementing downloads', error);
    res.status(500).json({ success: false, error: 'Failed to increment downloads' });
  }
});
