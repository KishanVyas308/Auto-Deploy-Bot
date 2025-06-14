import { Request, Response } from "express";
import { prisma } from "../globle";
import crypto from "crypto";

// GitHub webhook handler
export const handleGitHubWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId;
    const signature = req.headers['x-hub-signature-256'] as string;
    
    // Handle raw body from webhook
    let payload: string;
    let webhookData: any;
    
    if (Buffer.isBuffer(req.body)) {
      payload = req.body.toString();
      webhookData = JSON.parse(payload);
    } else {
      payload = JSON.stringify(req.body);
      webhookData = req.body;
    }

    // Get project and verify it exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { user: true }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Verify webhook signature
    if (!verifyGitHubSignature(payload, signature, project.webhookSecret || '')) {
      res.status(401).json({ message: "Invalid webhook signature" });
      return;
    }

    const event = req.headers['x-github-event'] as string;
    
    // Log webhook event
    await prisma.webhookEvent.create({
      data: {
        projectId,
        event,
        payload: webhookData,
        receivedAt: new Date()
      }
    });    // Handle different webhook events
    switch (event) {
      case 'ping':
        await handlePingEvent(projectId, webhookData);
        res.status(200).json({ message: "Webhook connected successfully!" });
        break;
        
      case 'push':
        await handlePushEvent(projectId, webhookData);
        res.status(200).json({ message: "Push event processed" });
        break;
        
      case 'pull_request':
        await handlePullRequestEvent(projectId, webhookData);
        res.status(200).json({ message: "Pull request event processed" });
        break;
        
      case 'release':
        await handleReleaseEvent(projectId, webhookData);
        res.status(200).json({ message: "Release event processed" });
        break;
        
      case 'issues':
        await handleIssuesEvent(projectId, webhookData);
        res.status(200).json({ message: "Issues event processed" });
        break;
        
      case 'workflow_run':
        await handleWorkflowRunEvent(projectId, webhookData);
        res.status(200).json({ message: "Workflow run event processed" });
        break;
        
      case 'repository':
        await handleRepositoryEvent(projectId, webhookData);
        res.status(200).json({ message: "Repository event processed" });
        break;
        
      default:
        console.log(`Received unhandled event: ${event}`);
        res.status(200).json({ message: `Event ${event} received and logged` });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Verify GitHub webhook signature
function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Handle ping event (when webhook is first connected)
async function handlePingEvent(projectId: string, payload: any): Promise<void> {
  try {
    console.log(`Ping event received for project ${projectId}`);
    
    // Update project to mark webhook as connected
    await prisma.project.update({
      where: { id: projectId },
      data: { 
        webhookConnected: true,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error("Error handling ping event:", error);
  }
}

// Handle push event
async function handlePushEvent(projectId: string, payload: any): Promise<void> {
  try {
    const { ref, head_commit, pusher } = payload;
    
    // Only process pushes to the main branch (or configured branch)
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!project) return;
    
    const targetBranch = `refs/heads/${project.githubBranch}`;
    if (ref !== targetBranch) {
      console.log(`Ignoring push to ${ref}, only processing ${targetBranch}`);
      return;
    }

    if (!head_commit) {
      console.log("No head commit found in push payload");
      return;
    }

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        userId: project.userId,
        commitHash: head_commit.id,
        commitMsg: head_commit.message,
        status: "PENDING",
        triggeredBy: pusher?.name || "webhook"
      }
    });

    console.log(`Created deployment ${deployment.id} for commit ${head_commit.id}`);
    
    // Here you would typically trigger your deployment process
    // For now, we'll just log it and mark it as accepted
    setTimeout(async () => {
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: "ACCEPTED" }
      });
    }, 1000);
    
  } catch (error) {
    console.error("Error handling push event:", error);
  }
}

// Handle pull request event
async function handlePullRequestEvent(projectId: string, payload: any): Promise<void> {
  try {
    const { action, pull_request, sender } = payload;
    
    console.log(`Pull request ${action} for project ${projectId}: PR #${pull_request?.number}`);
    
    // You can implement PR-specific logic here
    // For example, create preview deployments for PRs
    if (action === 'opened' || action === 'synchronize') {
      // Could create a preview deployment here
      console.log(`PR ${pull_request?.number} ${action}: ${pull_request?.title}`);
    }
    
  } catch (error) {
    console.error("Error handling pull request event:", error);
  }
}

// Handle release event
async function handleReleaseEvent(projectId: string, payload: any): Promise<void> {
  try {
    const { action, release, sender } = payload;
    
    console.log(`Release ${action} for project ${projectId}: ${release?.tag_name}`);
    
    if (action === 'published') {
      // Could trigger a production deployment here
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      });
      
      if (project && release?.target_commitish) {
        await prisma.deployment.create({
          data: {
            projectId,
            userId: project.userId,
            commitHash: release.target_commitish,
            commitMsg: `Release: ${release.name || release.tag_name}`,
            status: "PENDING",
            triggeredBy: `release:${sender?.login || 'webhook'}`
          }
        });
      }
    }
    
  } catch (error) {
    console.error("Error handling release event:", error);
  }
}

// Handle issues event
async function handleIssuesEvent(projectId: string, payload: any): Promise<void> {
  try {
    const { action, issue, sender } = payload;
    
    console.log(`Issue ${action} for project ${projectId}: #${issue?.number} - ${issue?.title}`);
    
  } catch (error) {
    console.error("Error handling issues event:", error);
  }
}

// Handle workflow run event
async function handleWorkflowRunEvent(projectId: string, payload: any): Promise<void> {
  try {
    const { action, workflow_run, sender } = payload;
    
    console.log(`Workflow ${action} for project ${projectId}: ${workflow_run?.name} - ${workflow_run?.conclusion}`);
    
  } catch (error) {
    console.error("Error handling workflow run event:", error);
  }
}

// Handle repository event
async function handleRepositoryEvent(projectId: string, payload: any): Promise<void> {
  try {
    const { action, repository, sender } = payload;
    
    console.log(`Repository ${action} for project ${projectId}: ${repository?.full_name}`);
    
  } catch (error) {
    console.error("Error handling repository event:", error);
  }
}

// Get webhook events for a project (for debugging/monitoring)
export const getWebhookEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user.id;
    const { limit = 50, event } = req.query;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const whereClause: any = { projectId };
    if (event && typeof event === 'string') {
      whereClause.event = event;
    }

    const events = await prisma.webhookEvent.findMany({
      where: whereClause,
      orderBy: { receivedAt: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        event: true,
        receivedAt: true,
        payload: true
      }
    });    // Transform events to include readable information
    const transformedEvents = events.map(event => {
      const payload = event.payload as any;
      let summary = '';
      let actor = '';
      let details = {};

      if (payload) {
        switch (event.event) {
          case 'push':
            summary = `Push to ${payload.ref?.replace('refs/heads/', '') || 'unknown branch'}`;
            actor = payload.pusher?.name || payload.head_commit?.author?.name || 'Unknown';
            details = {
              commits: payload.commits?.length || 0,
              commitMessage: payload.head_commit?.message,
              commitHash: payload.head_commit?.id?.substring(0, 7)
            };
            break;
          case 'pull_request':
            summary = `Pull request ${payload.action}: #${payload.pull_request?.number}`;
            actor = payload.sender?.login || 'Unknown';
            details = {
              title: payload.pull_request?.title,
              state: payload.pull_request?.state,
              action: payload.action
            };
            break;
          case 'release':
            summary = `Release ${payload.action}: ${payload.release?.tag_name}`;
            actor = payload.sender?.login || 'Unknown';
            details = {
              name: payload.release?.name,
              tagName: payload.release?.tag_name,
              prerelease: payload.release?.prerelease
            };
            break;
          case 'issues':
            summary = `Issue ${payload.action}: #${payload.issue?.number}`;
            actor = payload.sender?.login || 'Unknown';
            details = {
              title: payload.issue?.title,
              state: payload.issue?.state,
              action: payload.action
            };
            break;
          case 'ping':
            summary = 'Webhook connection test';
            actor = payload.sender?.login || 'GitHub';
            details = {
              hookId: payload.hook?.id
            };
            break;
          default:
            summary = `${event.event} event`;
            actor = payload.sender?.login || 'Unknown';
        }
      } else {
        summary = `${event.event} event`;
        actor = 'Unknown';
      }

      return {
        id: event.id,
        event: event.event,
        summary,
        actor,
        details,
        receivedAt: event.receivedAt,
        rawPayload: payload
      };
    });

    res.status(200).json({ events: transformedEvents });
  } catch (error) {
    console.error("Get webhook events error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get webhook statistics for a project
export const getWebhookStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user.id;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Get event counts by type
    const eventCounts = await prisma.webhookEvent.groupBy({
      by: ['event'],
      where: { projectId },
      _count: {
        event: true
      }
    });

    // Get recent activity (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await prisma.webhookEvent.count({
      where: {
        projectId,
        receivedAt: {
          gte: twentyFourHoursAgo
        }
      }
    });

    // Get total events
    const totalEvents = await prisma.webhookEvent.count({
      where: { projectId }
    });

    // Get last webhook received
    const lastEvent = await prisma.webhookEvent.findFirst({
      where: { projectId },
      orderBy: { receivedAt: 'desc' },
      select: {
        event: true,
        receivedAt: true
      }
    });

    const stats = {
      totalEvents,
      recentEvents,
      lastEvent,
      eventCounts: eventCounts.reduce((acc, item) => {
        acc[item.event] = item._count.event;
        return acc;
      }, {} as Record<string, number>),
      webhookConnected: project.webhookConnected
    };

    res.status(200).json({ stats });
  } catch (error) {
    console.error("Get webhook stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Test webhook endpoint - simulates a webhook event
export const testWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { eventType = 'ping' } = req.body;
    const userId = (req as any).user.id;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Create a test webhook event
    const testPayload = {
      test: true,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        repository: project.githubRepo
      },
      sender: {
        login: 'webhook-test',
        type: 'User'
      },
      message: `This is a test ${eventType} event for webhook validation`
    };

    // Log the test webhook event
    await prisma.webhookEvent.create({
      data: {
        projectId,
        event: `test_${eventType}`,
        payload: testPayload,
        receivedAt: new Date()
      }
    });

    // Update webhook connected status if this is the first successful test
    if (!project.webhookConnected) {
      await prisma.project.update({
        where: { id: projectId },
        data: { webhookConnected: true }
      });
    }

    res.status(200).json({ 
      message: `Test ${eventType} webhook event created successfully`,
      success: true,
      eventId: projectId,
      payload: testPayload
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    res.status(500).json({ 
      message: "Failed to create test webhook event",
      success: false
    });
  }
};
