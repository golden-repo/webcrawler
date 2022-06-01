# Puppeteer!
This is a POC build using Puppeteer and Headless Chrome. Puppeteer can be used to automate any user interactions as he/she used to on a daily basis. I am not qualifying this POC as RPA (Robotic Process Automation), but surely in that direction.

## Purpose
- Open the browser
- Connect github using userid & password.
- Open a perticular project (canbe configured to open all the projects one by one).
- Open readme file of that project. 
- Then add some extra comments to it using the default github editor.
- Commit the changes
- Close the browser

## Technology used
- [Node.js](https://nodejs.org/en/)
- [Puppeteer](https://developers.google.com/web/tools/puppeteer/)
- Some Node Modules

## How to start
- Download project files to a folder
- Follow below commands
    ```
    npm install
    npm start
    ```

## How to extend it 
- You can extend it as the process of automation is recorded in a file named [metadata.js](metadata.js)
- You also can add more modules to implement your way of automation.
- This tool can also be used as Web Scraping tool.

## Reference
- [Puppeteer](https://developers.google.com/web/tools/puppeteer/)
- [![Puppeteer Google IO18 video](https://img.youtube.com/vi/lhZOFUY1weo/0.jpg)](https://www.youtube.com/watch?v=lhZOFUY1weo)