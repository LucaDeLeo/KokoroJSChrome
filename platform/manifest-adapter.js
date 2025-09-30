/**
 * @module ManifestAdapter
 * @description Manifest version adapter for Chrome extension compatibility
 */

class ManifestAdapter {
  constructor() {
    this.manifest = null
    this.version = null
  }

  async initialize() {
    if (this._isExtensionEnvironment()) {
      this.manifest = chrome.runtime.getManifest()
      this.version = this.manifest.manifest_version
    }
  }

  async cleanup() {
    this.manifest = null
    this.version = null
  }

  getManifest() {
    return this.manifest
  }

  getVersion() {
    return this.version
  }

  getPermissions() {
    if (!this.manifest) {
      return []
    }

    const permissions = [...(this.manifest.permissions || [])]

    if (this.manifest.optional_permissions) {
      permissions.push(...this.manifest.optional_permissions.map(p => `${p} (optional)`))
    }

    if (this.manifest.host_permissions) {
      permissions.push(...this.manifest.host_permissions)
    }

    return permissions
  }

  hasPermission(permission) {
    if (!this.manifest) {
      return false
    }

    return (this.manifest.permissions && this.manifest.permissions.includes(permission)) ||
           (this.manifest.optional_permissions && this.manifest.optional_permissions.includes(permission))
  }

  getBackgroundConfig() {
    if (!this.manifest) {
      return null
    }

    if (this.version === 3) {
      return {
        type: 'service_worker',
        script: this.manifest.background?.service_worker,
        module: this.manifest.background?.type === 'module'
      }
    } else if (this.version === 2) {
      return {
        type: 'page',
        scripts: this.manifest.background?.scripts,
        page: this.manifest.background?.page,
        persistent: this.manifest.background?.persistent
      }
    }

    return null
  }

  getContentScripts() {
    return this.manifest?.content_scripts || []
  }

  getWebAccessibleResources() {
    if (!this.manifest) {
      return []
    }

    if (this.version === 3) {
      return this.manifest.web_accessible_resources || []
    } else if (this.version === 2) {
      return this.manifest.web_accessible_resources?.map(resource => ({
        resources: [resource],
        matches: ['<all_urls>']
      })) || []
    }

    return []
  }

  getAction() {
    if (!this.manifest) {
      return null
    }

    if (this.version === 3) {
      return this.manifest.action || null
    } else if (this.version === 2) {
      return this.manifest.browser_action || this.manifest.page_action || null
    }

    return null
  }

  getIcons() {
    return this.manifest?.icons || {}
  }

  getName() {
    return this.manifest?.name || 'Unknown'
  }

  getDescription() {
    return this.manifest?.description || ''
  }

  getExtensionVersion() {
    return this.manifest?.version || '0.0.0'
  }

  getMinimumChromeVersion() {
    return this.manifest?.minimum_chrome_version || null
  }

  getCapabilities() {
    if (!this.manifest) {
      return {
        available: false
      }
    }

    return {
      available: true,
      manifestVersion: this.version,
      name: this.getName(),
      version: this.getExtensionVersion(),
      permissions: this.getPermissions().length,
      contentScripts: this.getContentScripts().length,
      hasBackground: !!this.getBackgroundConfig(),
      hasAction: !!this.getAction(),
      minimumChrome: this.getMinimumChromeVersion()
    }
  }

  async test() {
    try {
      if (!this._isExtensionEnvironment()) {
        return {
          success: false,
          error: 'Not running in extension environment'
        }
      }

      return {
        success: true,
        manifest: {
          name: this.getName(),
          version: this.getExtensionVersion(),
          manifestVersion: this.version
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  _isExtensionEnvironment() {
    return typeof chrome !== 'undefined' &&
           chrome.runtime &&
           chrome.runtime.getManifest
  }
}

export { ManifestAdapter }