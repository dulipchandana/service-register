import { chromium, expect } from '@playwright/test';
import { spawn, ChildProcess, ExecSyncOptions, execSync } from 'child_process';
import * as path from 'path';
import waitOn from 'wait-on';
import * as http from 'http';
import * as which from 'which';

let serverProcess: ChildProcess | null = null;

async function checkServiceHealth(): Promise<boolean> {
    return new Promise((resolve) => {
        const request = http.get('http://localhost:5000/api/services', (res) => {
            resolve(res.statusCode === 200);
        });

        request.on('error', () => {
            resolve(false);
        });

        request.end();
    });
}

async function checkProcessRunning(): Promise<boolean> {
    try {
        // Check if node process running on port 5000
        const command = process.platform === 'win32' 
            ? `netstat -ano | findstr :5000`
            : `lsof -i :5000`;
        
        execSync(command);
        return true;
    } catch {
        return false;
    }
}

export async function startApiServer() {
    console.log('Checking API server status...');

    // First check if service is healthy
    const isHealthy = await checkServiceHealth();
    if (isHealthy) {
        console.log('API server is running and healthy');
        return;
    }

    // Check if process exists but not responding
    const isProcessRunning = await checkProcessRunning();
    if (isProcessRunning) {
        console.log('Found stale process on port 5000, attempting to terminate...');
        try {
            if (process.platform === 'win32') {
                execSync('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force"');
            } else {
                execSync('lsof -ti:5000 | xargs kill -9');
            }
            // Wait for port to be freed
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error('Error terminating existing process:', error);
        }
    }

    try {
        console.log('Starting API server...');
        const appPath = path.join(process.cwd(), '..', '..', 'app.js');
        
        // Ensure npm install is run first
        console.log('Installing dependencies...');
        const execOptions: ExecSyncOptions = {
            cwd: path.join(process.cwd(), '..', '..'),
            stdio: 'inherit'
        };
        
        try {
            const npmPath = process.platform === 'win32' 
                ? require('which').sync('npm.cmd', { nothrow: true }) 
                    || 'C:\\Program Files\\nodejs\\npm.cmd'
                : 'npm';
            
            console.log(`Using npm from path: ${npmPath}`);
            execSync(`"${npmPath}" install`, {
                ...execOptions,
                windowsHide: true,
                encoding: 'utf8'
            });
        } catch (error) {
            console.error('Failed to install dependencies:', error);
            // Continue even if npm install fails
            console.log('Continuing with server start despite npm install failure...');
        }

        // Start the server using Node's full path
        let nodePath = process.platform === 'win32'
            ? require('which').sync('node.exe', { nothrow: true })
                || '"C:\\Program Files\\nodejs\\node.exe"'
            : 'node';

        // On Windows, if the path contains spaces and is already quoted, don't quote it again
        if (process.platform === 'win32' && !nodePath.startsWith('"')) {
            nodePath = `"${nodePath}"`;
        }

        console.log(`Using Node.js from path: ${nodePath}`);
        serverProcess = spawn(nodePath, [appPath], {
            stdio: 'pipe',
            detached: false,
            env: { ...process.env, PORT: '5000' },
            windowsHide: true,
            shell: true
        });

        // Log server output
        serverProcess.stdout?.on('data', (data) => {
            console.log(`API Server stdout: ${data.toString()}`);
        });

        serverProcess.stderr?.on('data', (data) => {
            console.error(`API Server stderr: ${data.toString()}`);
        });

        serverProcess.on('error', (error) => {
            console.error('Failed to start API server:', error);
            throw error;
        });

        // Wait for the server to be ready with retries
        let retries = 5;
        while (retries > 0) {
            try {
                await waitOn({
                    resources: ['http://localhost:5000/api/docs'],
                    timeout: 10000,
                    interval: 1000,
                });
                
                // Double-check health
                const healthy = await checkServiceHealth();
                if (healthy) {
                    console.log('API server started and verified healthy');
                    return;
                }
                throw new Error('Service not healthy after start');
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                console.log(`Retry starting server (${retries} attempts left)...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    } catch (error) {
        console.error('Failed to start API server:', error);
        throw error;
    }
}

export async function stopApiServer() {
    try {
        if (serverProcess) {
            console.log('Stopping API server...');
            
            // Send SIGTERM first for graceful shutdown
            serverProcess.kill('SIGTERM');
            
            // Wait for process to exit gracefully
            await new Promise<void>((resolve) => {
                serverProcess?.once('exit', () => {
                    console.log('API server stopped gracefully');
                    serverProcess = null;
                    resolve();
                });
                
                // Force kill after 5 seconds if not exited
                setTimeout(() => {
                    if (serverProcess) {
                        console.log('Force stopping API server...');
                        serverProcess.kill('SIGKILL');
                        serverProcess = null;
                        resolve();
                    }
                }, 5000);
            });
        }
        
        // Double check no process is left on port 5000
        const isProcessRunning = await checkProcessRunning();
        if (isProcessRunning) {
            console.log('Cleaning up remaining process on port 5000...');
            if (process.platform === 'win32') {
                execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :5000') do taskkill /F /PID %a`);
            } else {
                execSync('lsof -ti:5000 | xargs kill -9');
            }
        }
    } catch (error) {
        console.error('Error stopping API server:', error);
        throw error;
    }
}
