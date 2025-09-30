/**
 * @module PluginLoader
 * @description Plugin loading and lifecycle management
 */

class PluginLoader {
  constructor() {
    this.plugins = new Map()
    this.loadedPlugins = new Map()
    this.pluginManifest = null
  }

  async loadManifest(manifestPath = './plugin-manifest.json') {
    try {
      const response = await fetch(manifestPath)
      if (!response.ok) {
        throw new Error(`Failed to load plugin manifest: ${response.status}`)
      }
      this.pluginManifest = await response.json()
      return this.pluginManifest
    } catch (error) {
      console.error('Failed to load plugin manifest:', error)
      throw error
    }
  }

  async loadPlugin(pluginConfig, eventBus, pal) {
    const { id, name, path, version, dependencies = [], config = {} } = pluginConfig

    if (this.plugins.has(id)) {
      console.warn(`Plugin ${id} already loaded`)
      return this.plugins.get(id)
    }

    await this._checkDependencies(dependencies)

    if (!this._checkVersion(version)) {
      throw new Error(`Plugin ${id} version ${version} is not compatible`)
    }

    try {
      const pluginModule = await this._importPlugin(path)

      if (!pluginModule.default && !pluginModule.Plugin) {
        throw new Error(`Plugin ${id} does not export a valid plugin class`)
      }

      const PluginClass = pluginModule.default || pluginModule.Plugin
      const pluginInstance = new PluginClass(config)

      if (!this._validatePluginInterface(pluginInstance)) {
        throw new Error(`Plugin ${id} does not implement required interface`)
      }

      await pluginInstance.init(eventBus, pal)

      const plugin = {
        id,
        name,
        version,
        instance: pluginInstance,
        config,
        dependencies,
        status: 'active'
      }

      this.plugins.set(id, plugin)
      this.loadedPlugins.set(id, pluginInstance)

      console.log(`Plugin ${name} (${id}) v${version} loaded successfully`)

      return plugin
    } catch (error) {
      console.error(`Failed to load plugin ${id}:`, error)
      throw error
    }
  }

  async loadAllPlugins(eventBus, pal) {
    if (!this.pluginManifest) {
      await this.loadManifest()
    }

    const loadOrder = this._calculateLoadOrder(this.pluginManifest.plugins)
    const loadedPlugins = []

    for (const pluginConfig of loadOrder) {
      if (pluginConfig.enabled !== false) {
        try {
          const plugin = await this.loadPlugin(pluginConfig, eventBus, pal)
          loadedPlugins.push(plugin)
        } catch (error) {
          if (pluginConfig.required !== false) {
            throw error
          } else {
            console.warn(`Optional plugin ${pluginConfig.id} failed to load:`, error)
          }
        }
      }
    }

    return loadedPlugins
  }

  async unloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      return false
    }

    const dependents = this._findDependents(pluginId)
    if (dependents.length > 0) {
      throw new Error(`Cannot unload plugin ${pluginId}: plugins ${dependents.join(', ')} depend on it`)
    }

    try {
      if (plugin.instance.cleanup) {
        await plugin.instance.cleanup()
      }

      plugin.status = 'unloaded'
      this.plugins.delete(pluginId)
      this.loadedPlugins.delete(pluginId)

      console.log(`Plugin ${plugin.name} (${pluginId}) unloaded successfully`)
      return true
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error)
      throw error
    }
  }

  async reloadPlugin(pluginId, eventBus, pal) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const config = {
      id: plugin.id,
      name: plugin.name,
      path: `./plugins/${plugin.id}`,
      version: plugin.version,
      dependencies: plugin.dependencies,
      config: plugin.config
    }

    await this.unloadPlugin(pluginId)
    return await this.loadPlugin(config, eventBus, pal)
  }

  getPlugin(pluginId) {
    return this.loadedPlugins.get(pluginId)
  }

  getAllPlugins() {
    return Array.from(this.plugins.values())
  }

  getPluginStatus(pluginId) {
    const plugin = this.plugins.get(pluginId)
    return plugin ? plugin.status : 'not-loaded'
  }

  async _importPlugin(path) {
    const fullPath = `${path}/index.js`
    try {
      return await import(fullPath)
    } catch (error) {
      console.error(`Failed to import plugin from ${fullPath}:`, error)
      throw error
    }
  }

  _validatePluginInterface(pluginInstance) {
    const requiredMethods = ['init']
    const recommendedMethods = ['process', 'cleanup']

    for (const method of requiredMethods) {
      if (typeof pluginInstance[method] !== 'function') {
        console.error(`Plugin missing required method: ${method}`)
        return false
      }
    }

    for (const method of recommendedMethods) {
      if (typeof pluginInstance[method] !== 'function') {
        console.warn(`Plugin missing recommended method: ${method}`)
      }
    }

    return true
  }

  _checkVersion(version) {
    const versionPattern = /^\d+\.\d+\.\d+$/
    if (!versionPattern.test(version)) {
      console.warn(`Invalid version format: ${version}`)
      return false
    }

    const [major, minor, patch] = version.split('.').map(Number)

    const minVersion = { major: 1, minor: 0, patch: 0 }
    const maxVersion = { major: 2, minor: 0, patch: 0 }

    if (major < minVersion.major || major >= maxVersion.major) {
      return false
    }

    return true
  }

  async _checkDependencies(dependencies) {
    for (const depId of dependencies) {
      if (!this.plugins.has(depId)) {
        throw new Error(`Dependency ${depId} not loaded`)
      }

      const dep = this.plugins.get(depId)
      if (dep.status !== 'active') {
        throw new Error(`Dependency ${depId} is not active`)
      }
    }
  }

  _findDependents(pluginId) {
    const dependents = []
    for (const [id, plugin] of this.plugins.entries()) {
      if (plugin.dependencies.includes(pluginId)) {
        dependents.push(id)
      }
    }
    return dependents
  }

  _calculateLoadOrder(plugins) {
    const sorted = []
    const visited = new Set()
    const visiting = new Set()

    const visit = (plugin) => {
      if (visited.has(plugin.id)) {
        return
      }

      if (visiting.has(plugin.id)) {
        throw new Error(`Circular dependency detected for plugin: ${plugin.id}`)
      }

      visiting.add(plugin.id)

      for (const depId of (plugin.dependencies || [])) {
        const dep = plugins.find(p => p.id === depId)
        if (dep) {
          visit(dep)
        } else if (plugin.required !== false) {
          throw new Error(`Plugin ${plugin.id} depends on non-existent plugin: ${depId}`)
        }
      }

      sorted.push(plugin)
      visiting.delete(plugin.id)
      visited.add(plugin.id)
    }

    for (const plugin of plugins) {
      visit(plugin)
    }

    return sorted
  }

  async healthCheck() {
    const results = {}

    for (const [id, plugin] of this.plugins.entries()) {
      try {
        if (plugin.instance.healthCheck) {
          results[id] = await plugin.instance.healthCheck()
        } else {
          results[id] = { healthy: plugin.status === 'active' }
        }
      } catch (error) {
        results[id] = {
          healthy: false,
          error: error.message
        }
      }
    }

    return results
  }
}

export { PluginLoader }