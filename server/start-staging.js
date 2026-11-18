#!/usr/bin/env node
/**
 * Safe Staging Server Launcher
 * Starts the Node.js/Express API server connected strictly to EmployeeApp-Staging.
 * Loads server/.env.test and enforces isolation guards preventing connection to production.
 */

process.env.NODE_ENV = 'staging';
process.env.APP_ENV = 'staging';
process.env.START_SERVER = 'true';

console.log('===============================================================================');
console.log('         EMPLOYEEAPP - BACKEND STAGING SERVER LAUNCHER                         ');
console.log('===============================================================================');
console.log('Target Database: EmployeeApp-Staging (loaded from server/.env.test)');
console.log('Production database protection is ACTIVE.\n');

require('./src/index.js');
