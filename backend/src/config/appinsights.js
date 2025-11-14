const appInsights = require('applicationinsights');
const logger = require('../utils/logger');

/**
 * Initialize Azure Application Insights for monitoring and telemetry
 */
const initializeAppInsights = () => {
  try {
    const connectionString = process.env.APPINSIGHTS_CONNECTION_STRING;
    const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATION_KEY;

    if (!connectionString && !instrumentationKey) {
      logger.warn('Application Insights not configured - monitoring disabled');
      return null;
    }

    // Setup and start Application Insights with new API
    if (connectionString) {
      appInsights.setup(connectionString);
    } else if (instrumentationKey) {
      appInsights.setup(instrumentationKey);
    }

    // Configure before starting (new API)
    const config = appInsights.defaultClient?.config;
    if (config) {
      config.enableAutoCollectExternalLoggers = true;
      config.enableAutoCollectExceptions = true;
      config.enableAutoCollectPerformance = true;
      config.enableAutoCollectRequests = true;
      config.enableAutoCollectDependencies = true;
      config.enableAutoDependencyCorrelation = true;
      config.enableUseDiskRetryCaching = true;
    }

    // Start Application Insights
    appInsights.start();

    logger.info('✅ Application Insights initialized successfully');

    return appInsights.defaultClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Application Insights:', error);
    return null;
  }
};

/**
 * Get the Application Insights client
 * @returns {TelemetryClient|null}
 */
const getAppInsightsClient = () => {
  return appInsights.defaultClient || null;
};

/**
 * Track custom event
 * @param {string} name - Event name
 * @param {object} properties - Event properties
 * @param {object} measurements - Event measurements
 */
const trackEvent = (name, properties = {}, measurements = {}) => {
  const client = getAppInsightsClient();
  if (client) {
    client.trackEvent({
      name,
      properties,
      measurements
    });
  }
};

/**
 * Track custom metric
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @param {object} properties - Additional properties
 */
const trackMetric = (name, value, properties = {}) => {
  const client = getAppInsightsClient();
  if (client) {
    client.trackMetric({
      name,
      value,
      properties
    });
  }
};

/**
 * Track exception
 * @param {Error} exception - Exception object
 * @param {object} properties - Additional properties
 */
const trackException = (exception, properties = {}) => {
  const client = getAppInsightsClient();
  if (client) {
    client.trackException({
      exception,
      properties
    });
  }
};

/**
 * Track dependency (external calls)
 * @param {object} dependency - Dependency details
 */
const trackDependency = (dependency) => {
  const client = getAppInsightsClient();
  if (client) {
    client.trackDependency(dependency);
  }
};

/**
 * Flush telemetry data
 * @returns {Promise<void>}
 */
const flushTelemetry = () => {
  return new Promise((resolve) => {
    const client = getAppInsightsClient();
    if (client) {
      client.flush({
        callback: () => resolve()
      });
    } else {
      resolve();
    }
  });
};

module.exports = {
  initializeAppInsights,
  getAppInsightsClient,
  trackEvent,
  trackMetric,
  trackException,
  trackDependency,
  flushTelemetry
};
