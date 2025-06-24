/**
 * Performance monitoring and health check utilities
 */

import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';

/**
 * Performance metrics collector
 */
export class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.metrics = new Map();
    this.intervals = new Map();
    this.enabled = options.enabled !== false;
    this.collectInterval = options.collectInterval || 5000; // 5 seconds
    this.maxMetricAge = options.maxMetricAge || 300000; // 5 minutes
    
    if (this.enabled) {
      this.startCollection();
    }
  }
  
  startCollection() {
    // Collect system metrics
    const systemInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.collectInterval);
    
    this.intervals.set('system', systemInterval);
    
    // Clean up old metrics
    const cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.collectInterval * 2);
    
    this.intervals.set('cleanup', cleanupInterval);
  }
  
  collectSystemMetrics() {
    const now = Date.now();
    
    // CPU usage
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length;
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = usedMem / totalMem;
    
    // Process memory
    const processMemory = process.memoryUsage();
    
    this.addMetric('system.cpu.usage', cpuUsage, now);
    this.addMetric('system.memory.usage', memUsage, now);
    this.addMetric('system.memory.total', totalMem, now);
    this.addMetric('system.memory.free', freeMem, now);
    this.addMetric('process.memory.rss', processMemory.rss, now);
    this.addMetric('process.memory.heapUsed', processMemory.heapUsed, now);
    this.addMetric('process.memory.heapTotal', processMemory.heapTotal, now);
    
    // Load average (Unix-like systems)
    if (os.loadavg) {
      const [load1, load5, load15] = os.loadavg();
      this.addMetric('system.load.1min', load1, now);
      this.addMetric('system.load.5min', load5, now);
      this.addMetric('system.load.15min', load15, now);
    }
  }
  
  addMetric(name, value, timestamp = Date.now()) {
    if (!this.enabled) return;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricData = this.metrics.get(name);
    metricData.push({ value, timestamp });
    
    // Keep only recent data
    const cutoff = timestamp - this.maxMetricAge;
    this.metrics.set(name, metricData.filter(d => d.timestamp > cutoff));
    
    this.emit('metric', { name, value, timestamp });
  }
  
  getMetric(name, timeRange = 60000) { // Default 1 minute
    const data = this.metrics.get(name) || [];
    const cutoff = Date.now() - timeRange;
    
    return data.filter(d => d.timestamp > cutoff);
  }
  
  getMetricStats(name, timeRange = 60000) {
    const data = this.getMetric(name, timeRange);
    
    if (data.length === 0) {
      return null;
    }
    
    const values = data.map(d => d.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = data[data.length - 1].value;
    
    return { avg, min, max, latest, count: values.length };
  }
  
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.maxMetricAge;
    
    for (const [name, data] of this.metrics.entries()) {
      const filtered = data.filter(d => d.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    }
  }
  
  getHealthStatus() {
    const now = Date.now();
    const health = {
      status: 'healthy',
      timestamp: now,
      issues: [],
      metrics: {}
    };
    
    // Check CPU usage
    const cpuStats = this.getMetricStats('system.cpu.usage');
    if (cpuStats) {
      health.metrics.cpu = cpuStats;
      if (cpuStats.avg > 0.9) {
        health.issues.push('High CPU usage detected');
        health.status = 'warning';
      }
    }
    
    // Check memory usage
    const memStats = this.getMetricStats('system.memory.usage');
    if (memStats) {
      health.metrics.memory = memStats;
      if (memStats.latest > 0.9) {
        health.issues.push('High memory usage detected');
        health.status = health.status === 'healthy' ? 'warning' : 'critical';
      }
    }
    
    // Check process memory
    const processMemStats = this.getMetricStats('process.memory.heapUsed');
    if (processMemStats) {
      health.metrics.processMemory = processMemStats;
    }
    
    if (health.issues.length > 2) {
      health.status = 'critical';
    }
    
    return health;
  }
  
  stop() {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.enabled = false;
  }
}

/**
 * Operation timer for measuring execution time
 */
export class OperationTimer {
  constructor(name) {
    this.name = name;
    this.startTime = process.hrtime.bigint();
    this.checkpoints = [];
  }
  
  checkpoint(label) {
    const now = process.hrtime.bigint();
    const elapsed = Number(now - this.startTime) / 1e6; // Convert to milliseconds
    
    this.checkpoints.push({ label, elapsed, timestamp: Date.now() });
    return elapsed;
  }
  
  end() {
    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - this.startTime) / 1e6;
    
    return {
      operation: this.name,
      totalTime,
      checkpoints: this.checkpoints,
      startTime: this.startTime,
      endTime
    };
  }
}

/**
 * Disk space monitor
 */
export class DiskSpaceMonitor {
  constructor(paths = [process.cwd()]) {
    this.paths = Array.isArray(paths) ? paths : [paths];
  }
  
  async checkSpace() {
    const results = {};
    
    for (const path of this.paths) {
      try {
        const stats = await fs.promises.stat(path);
        if (stats.isDirectory()) {
          // For directories, check parent filesystem
          const stat = await fs.promises.statfs ? 
            fs.promises.statfs(path) : 
            this._getFallbackDiskInfo(path);
          
          results[path] = {
            total: stat.blocks * stat.blocksize,
            free: stat.bavail * stat.blocksize,
            used: (stat.blocks - stat.bavail) * stat.blocksize,
            usagePercent: ((stat.blocks - stat.bavail) / stat.blocks) * 100
          };
        }
      } catch (error) {
        results[path] = { error: error.message };
      }
    }
    
    return results;
  }
  
  _getFallbackDiskInfo(path) {
    // Fallback for systems without statfs
    return {
      blocks: 1000000,
      blocksize: 4096,
      bavail: 500000
    };
  }
  
  async getSpaceWarnings(threshold = 90) {
    const spaceInfo = await this.checkSpace();
    const warnings = [];
    
    for (const [path, info] of Object.entries(spaceInfo)) {
      if (info.error) {
        warnings.push(`Cannot check disk space for ${path}: ${info.error}`);
      } else if (info.usagePercent > threshold) {
        warnings.push(`Disk usage for ${path} is ${info.usagePercent.toFixed(1)}% (${(info.used / 1024 / 1024 / 1024).toFixed(2)} GB used)`);
      }
    }
    
    return warnings;
  }
}

/**
 * Health check aggregator
 */
export class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.results = new Map();
  }
  
  addCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      description: options.description || name
    });
  }
  
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }
    
    const timer = new OperationTimer(`health-check-${name}`);
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });
      
      const result = await Promise.race([check.fn(), timeoutPromise]);
      const timing = timer.end();
      
      const checkResult = {
        name,
        status: 'healthy',
        message: result.message || 'OK',
        data: result.data || {},
        timing: timing.totalTime,
        timestamp: Date.now(),
        critical: check.critical
      };
      
      this.results.set(name, checkResult);
      return checkResult;
    } catch (error) {
      const timing = timer.end();
      
      const checkResult = {
        name,
        status: 'unhealthy',
        message: error.message,
        error: error,
        timing: timing.totalTime,
        timestamp: Date.now(),
        critical: check.critical
      };
      
      this.results.set(name, checkResult);
      return checkResult;
    }
  }
  
  async runAllChecks() {
    const results = [];
    
    for (const name of this.checks.keys()) {
      const result = await this.runCheck(name);
      results.push(result);
    }
    
    return results;
  }
  
  getOverallHealth() {
    const results = Array.from(this.results.values());
    
    if (results.length === 0) {
      return { status: 'unknown', message: 'No health checks configured' };
    }
    
    const unhealthyResults = results.filter(r => r.status === 'unhealthy');
    const criticalUnhealthy = unhealthyResults.filter(r => r.critical);
    
    if (criticalUnhealthy.length > 0) {
      return {
        status: 'critical',
        message: `${criticalUnhealthy.length} critical health check(s) failing`,
        failedChecks: criticalUnhealthy.map(r => r.name)
      };
    }
    
    if (unhealthyResults.length > 0) {
      return {
        status: 'warning',
        message: `${unhealthyResults.length} health check(s) failing`,
        failedChecks: unhealthyResults.map(r => r.name)
      };
    }
    
    return {
      status: 'healthy',
      message: 'All health checks passing',
      totalChecks: results.length
    };
  }
}

/**
 * Create a basic health checker with common checks
 */
export function createBasicHealthChecker() {
  const checker = new HealthChecker();
  const diskMonitor = new DiskSpaceMonitor();
  
  // Disk space check
  checker.addCheck('disk-space', async () => {
    const warnings = await diskMonitor.getSpaceWarnings(85);
    if (warnings.length > 0) {
      throw new Error(`Disk space warnings: ${warnings.join(', ')}`);
    }
    return { message: 'Disk space OK' };
  }, { critical: true, description: 'Check available disk space' });
  
  // Memory check
  checker.addCheck('memory', async () => {
    const usage = process.memoryUsage();
    const memoryUsageMB = usage.heapUsed / 1024 / 1024;
    
    if (memoryUsageMB > 1024) { // 1GB
      throw new Error(`High memory usage: ${memoryUsageMB.toFixed(2)} MB`);
    }
    
    return {
      message: 'Memory usage OK',
      data: { heapUsedMB: memoryUsageMB.toFixed(2) }
    };
  }, { description: 'Check process memory usage' });
  
  // Event loop lag check
  checker.addCheck('event-loop', async () => {
    const start = process.hrtime.bigint();
    await new Promise(resolve => setImmediate(resolve));
    const lag = Number(process.hrtime.bigint() - start) / 1e6;
    
    if (lag > 100) { // 100ms
      throw new Error(`High event loop lag: ${lag.toFixed(2)}ms`);
    }
    
    return {
      message: 'Event loop OK',
      data: { lagMs: lag.toFixed(2) }
    };
  }, { description: 'Check event loop responsiveness' });
  
  return checker;
}
