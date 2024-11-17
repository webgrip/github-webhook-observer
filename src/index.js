const express = require('express');
const bodyParser = require('body-parser');
const client = require('prom-client');
const app = express();
const collectDefaultMetrics = client.collectDefaultMetrics;

// Probe every 5th second.
collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const jobDuration = new client.Histogram({
    name: 'github_actions_job_duration_seconds',
    help: 'Duration of GitHub Actions jobs in seconds',
    labelNames: ['status', 'job_name', 'client']
});

const jobCounter = new client.Counter({
    name: 'github_actions_jobs_total',
    help: 'Total number of GitHub Actions jobs',
    labelNames: ['status', 'job_name', 'client']
});

const runningJobsGauge = new client.Gauge({
    name: 'github_actions_running_jobs',
    help: 'Number of currently running GitHub Actions jobs',
    labelNames: ['client']
});

const latestJobs = new client.Gauge({
    name: 'github_actions_latest_jobs',
    help: 'Latest GitHub Actions job statuses',
    labelNames: ['status', 'job_name', 'client']
});

// Additional metrics
const prReviewsCounter = new client.Counter({
    name: 'github_pr_reviews_total',
    help: 'Total number of pull request reviews',
    labelNames: ['action', 'client']
});

const prCommentsCounter = new client.Counter({
    name: 'github_pr_review_comments_total',
    help: 'Total number of pull request review comments',
    labelNames: ['action', 'client']
});

const issueCommentsCounter = new client.Counter({
    name: 'github_issue_comments_total',
    help: 'Total number of issue comments',
    labelNames: ['action', 'client']
});

// Update metrics based on webhook events
app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    console.log('Received a POST request on /webhook');
    const event = req.body;

    switch (req.headers['x-github-event']) {
        case 'ping':
            console.log('Received ping event');
            break;
        case 'workflow_run':
            handleWorkflowRun(event);
            break;
        case 'workflow_job':
            handleWorkflowJob(event);
            break;
        case 'check_run':
            handleCheckRun(event);
            break;
        case 'push':
            handlePush(event);
            break;
        case 'pull_request':
            handlePullRequest(event);
            break;
        case 'pull_request_review':
            handlePullRequestReview(event);
            break;
        case 'pull_request_review_comment':
            console.log('Handling pull_request_review_comment event');
            handlePullRequestReviewComment(event);
            break;
        case 'issues':
            console.log('Handling issues event');
            handleIssues(event);
            break;
        case 'issue_comment':
            console.log('Handling issue_comment event');
            handleIssueComment(event);
            break;
        default:
            console.log(`Unhandled event type: ${req.headers['x-github-event']}`);
    }

    res.status(200).send('Webhook received');
    console.log('Webhook processed successfully');
});

function handleWorkflowRun(event) {
    if (event.action === 'completed') {
        const { workflow_run } = event;
        const clientName = workflow_run.repository.owner.login;
        const jobName = workflow_run.name;
        const status = workflow_run.conclusion;
        const duration = (new Date(workflow_run.updated_at) - new Date(workflow_run.created_at)) / 1000;

        jobDuration.labels(status, jobName, clientName).observe(duration);
        jobCounter.labels(status, jobName, clientName).inc();
        runningJobsGauge.labels(clientName).dec();
        latestJobs.labels(status, jobName, clientName).setToCurrentTime();
    } else if (event.action === 'requested') {
        const { workflow_run } = event;
        const clientName = workflow_run.repository.owner.login;
        runningJobsGauge.labels(clientName).inc();
    }
}

function handleWorkflowJob(event) {
    if (event.action === 'completed') {
        const { workflow_job, repository } = event;
        const clientName = repository.owner.login;
        const jobName = workflow_job.name;
        const status = workflow_job.conclusion;
        const duration = (new Date(workflow_job.completed_at) - new Date(workflow_job.started_at)) / 1000;

        jobDuration.labels(status, jobName, clientName).observe(duration);
        jobCounter.labels(status, jobName, clientName).inc();
        runningJobsGauge.labels(clientName).dec();
        latestJobs.labels(status, jobName, clientName).setToCurrentTime();
    } else if (event.action === 'queued') {
        const { workflow_job } = event;
        const clientName = workflow_job.repository.owner.login;
        runningJobsGauge.labels(clientName).inc();
    }
}

function handleCheckRun(event) {
    if (event.action === 'completed') {
        const { check_run } = event;
        const clientName = check_run.repository.owner.login;
        const jobName = check_run.name;
        const status = check_run.conclusion;
        const duration = (new Date(check_run.completed_at) - new Date(check_run.started_at)) / 1000;

        jobDuration.labels(status, jobName, clientName).observe(duration);
        jobCounter.labels(status, jobName, clientName).inc();
    }
}

function handlePush(event) {
    if (event.ref && event.commits) {
        const clientName = event.repository.owner.login;
        const jobName = 'push';
        const status = 'success';
        const duration = 0; // Push events don't have a duration

        jobDuration.labels(status, jobName, clientName).observe(duration);
        jobCounter.labels(status, jobName, clientName).inc();
        latestJobs.labels(status, jobName, clientName).setToCurrentTime();
    }
}

function handlePullRequest(event) {
    if (event.action) {
        const clientName = event.repository.owner.login;
        prReviewsCounter.labels(event.action, clientName).inc();
    }
}

function handlePullRequestReview(event) {
    if (event.action) {
        const clientName = event.repository.owner.login;
        prReviewsCounter.labels(event.action, clientName).inc();
    }
}

function handlePullRequestReviewComment(event) {
    if (event.action) {
        const clientName = event.repository.name;
        prCommentsCounter.labels(event.action, clientName).inc();

        // Log the details of the comment
        console.log(`Pull request review comment event: ${event.action}`);
        console.log(`Comment details: ${JSON.stringify(event.comment, null, 2)}`);
    }
}

function handleIssues(event) {
    if (event.action) {
        const clientName = event.repository.name;
        issueCommentsCounter.labels(event.action, clientName).inc();
    }
}

function handleIssueComment(event) {
    if (event.action) {
        const clientName = event.repository.name;
        issueCommentsCounter.labels(event.action, clientName).inc();

        // Log the details of the comment
        console.log(`Issue comment event: ${event.action}`);
        console.log(`Comment details: ${JSON.stringify(event.comment, null, 2)}`);
    }
}

app.get('/metrics', async (req, res) => {
    console.log('Received a GET request on /metrics');
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
    console.log('Metrics sent successfully');
});

app.listen(8000, () => {
    console.log('Webhook receiver listening on port 8000');
});