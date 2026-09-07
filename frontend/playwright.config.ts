import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:30_000,
  expect:{timeout:8_000},
  fullyParallel:false,
  workers:1,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:4173',
    headless:true,
    browserName:'chromium',
    launchOptions:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'},
    viewport:{width:390,height:844},
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
  },
  webServer:[
    {command:'npm.cmd run test:browser-server',cwd:'../backend',url:'http://127.0.0.1:5001/api/v1/health',timeout:30_000,reuseExistingServer:false,env:{CLIENT_URL:'http://127.0.0.1:4173'}},
    {command:'npm.cmd run dev -- --host 127.0.0.1 --port 4173',cwd:'.',url:'http://127.0.0.1:4173',timeout:30_000,reuseExistingServer:false,env:{VITE_DEV_API_TARGET:'http://127.0.0.1:5001'}},
  ],
});
