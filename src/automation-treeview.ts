import * as vscode from 'vscode';
import { Container } from './container';
import { Folder, Job, JobStatus, Script, Terminal } from './types';
import ParentTreeItem from './parentTreeItem';
import compareVersions = require('compare-versions');

export class AutomationTreeViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined> = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> = this._onDidChangeTreeData.event;

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: vscode.TreeItem | undefined) {
        if (element == null) {
            return [
                new ScriptsTreeItem(),
                new JobsTreeItem(),
                new TerminalsTreeItem()
            ]
        }

        if (element instanceof ParentTreeItem) {
            var parentTreeItem = element as ParentTreeItem;
            return parentTreeItem.getChildren();
        }
    }

    refresh(node?: vscode.TreeItem): void {
        this._onDidChangeTreeData.fire(node);
    }
}

export class ScriptsTreeItem extends ParentTreeItem {
    constructor() {
        super("Scripts", vscode.TreeItemCollapsibleState.Collapsed);

        this.iconPath = new vscode.ThemeIcon('files');
    }

    async getChildren(): Promise<vscode.TreeItem[]> {
        let treeItems = [] as vscode.TreeItem[];

        try {
            treeItems = await Container.universal.getRootFolders().then(x => x.sort((a, b) => (a.name > b.name) ? 1 : -1).map(y => new FolderTreeItem(y)));
        }
        catch (err) {
            Container.universal.showConnectionError("Failed to query scripts. " + err);
            return [];
        }

        try {
            var scripts = await Container.universal.getRootScripts().then(x => x.sort((a, b) => (a.name > b.name) ? 1 : -1).map(y => new ScriptTreeItem(y)));
            treeItems = treeItems.concat(scripts);
        }
        catch (err) {
            Container.universal.showConnectionError("Failed to query scripts. " + err);
            return [];
        }

        return treeItems;
    }
}

export class FolderTreeItem extends ParentTreeItem {
    public folder: Folder;

    constructor(folder: Folder) {
        super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);

        this.folder = folder;
        const themeIcon = new vscode.ThemeIcon('folder');
        this.iconPath = themeIcon;
    }

    async getChildren(): Promise<vscode.TreeItem[]> {

        let treeItems = [] as vscode.TreeItem[];

        const version = await Container.universal.getVersion();

        if (compareVersions(version, "5.5.0") < 0) {
            var scripts = await Container.universal.getScripts().then(x => x.sort((a, b) => (a.name > b.name) ? 1 : -1).map(y => new ScriptTreeItem(y)));
            treeItems = treeItems.concat(scripts);
            return treeItems;
        }

        try {
            treeItems = await Container.universal.getFoldersInFolder(this.folder).then(x => x.sort((a, b) => (a.name > b.name) ? 1 : -1).map(y => new FolderTreeItem(y)));
        }
        catch (err) {
            Container.universal.showConnectionError("Failed to query folders. " + err);
            return [];
        }

        try {
            var scripts = await Container.universal.getScriptsInFolder(this.folder).then(x => x.sort((a, b) => (a.name > b.name) ? 1 : -1).map(y => new ScriptTreeItem(y)));
            treeItems = treeItems.concat(scripts);
        }
        catch (err) {
            Container.universal.showConnectionError("Failed to query scripts. " + err);
            return [];
        }

        return treeItems;
    }

    contextValue = "folder";
}

export class ScriptTreeItem extends vscode.TreeItem {
    public script: Script;

    constructor(script: Script) {
        super(script.name, vscode.TreeItemCollapsibleState.None);

        this.script = script;
        const themeIcon = new vscode.ThemeIcon('file-code');
        this.iconPath = themeIcon;
    }

    contextValue = "script";
}

export class TerminalsTreeItem extends ParentTreeItem {
    constructor() {
        super("Terminals", vscode.TreeItemCollapsibleState.Collapsed);

        this.iconPath = new vscode.ThemeIcon('terminal');
    }

    async getChildren(): Promise<vscode.TreeItem[]> {
        try {
            return await Container.universal.getTerminals().then(x => x.sort((a, b) => (a.name > b.name) ? 1 : -1).map(y => new TerminalTreeItem(y)));
        }
        catch (err) {
            Container.universal.showConnectionError("Failed to query scripts. " + err);
            return [];
        }
    }
}

export class TerminalTreeItem extends vscode.TreeItem {
    public terminal: Terminal;

    constructor(terminal: Terminal) {
        super(terminal.name, vscode.TreeItemCollapsibleState.None);

        this.terminal = terminal;
        const themeIcon = new vscode.ThemeIcon('terminal');
        this.iconPath = themeIcon;
    }

    contextValue = "terminal";
}


export class JobsTreeItem extends ParentTreeItem {
    constructor() {
        super("Jobs", vscode.TreeItemCollapsibleState.Collapsed);

        this.iconPath = new vscode.ThemeIcon('checklist');
    }

    async getChildren(): Promise<vscode.TreeItem[]> {
        try {
            return await Container.universal.getJobs().then(x => x.page.sort((a, b) => (a.id < b.id) ? 1 : -1).map(y => new JobTreeItem(y)));
        }
        catch (err) {
            Container.universal.showConnectionError("Failed to query jobs. " + err);
            return [];
        }
    }
}

export class JobTreeItem extends vscode.TreeItem {
    public job: Job;

    constructor(job: Job) {
        super(job.scriptFullPath, vscode.TreeItemCollapsibleState.None);

        this.job = job;

        if (job.status == JobStatus.Completed) {
            this.iconPath = new vscode.ThemeIcon('check');
            this.tooltip = 'Completed successfully';
        }
        if (job.status == JobStatus.Running) {
            this.iconPath = new vscode.ThemeIcon('play');
            this.tooltip = 'Running';
        }
        if (job.status == JobStatus.Failed) {
            this.iconPath = new vscode.ThemeIcon('error');
            this.tooltip = 'Failed';
        }
        if (job.status == JobStatus.WaitingOnFeedback) {
            this.iconPath = new vscode.ThemeIcon('question');
            this.tooltip = 'Waiting on feedback';
        }

        this.description = job.id.toString();
    }

    contextValue = "job";
}