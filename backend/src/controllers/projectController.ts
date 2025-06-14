import { Request, Response } from "express";
import { prisma } from "../globle";
import crypto from "crypto";

// Get all projects for a user
export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id; // From JWT middleware

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        deployments: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { deployments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ projects });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get single project
export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        webhookEvents: {
          orderBy: { receivedAt: 'desc' },
          take: 5
        },
        _count: {
          select: { deployments: true }
        }
      }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(200).json({ project });
  } catch (error) {
    console.error("Get project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create new project
export const createProject = async (req: Request, res: Response): Promise<void> => {  try {
    const { name, githubRepo, githubBranch = "main" } = req.body;
    const userId = (req as any).user.id;

    if (!name || !githubRepo) {
      res.status(400).json({ message: "Project name and GitHub repository are required" });
      return;
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const project = await prisma.project.create({
      data: {
        name,
        githubRepo,
        githubBranch,
        webhookSecret,
        userId
      }
    });    res.status(201).json({ 
      message: "Project created successfully", 
      project,
      webhookUrl: `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3000'}/api/v1/webhook/github/${project.id}`,
      webhookSecret: webhookSecret
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update project
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, githubRepo, githubBranch } = req.body;
    const userId = (req as any).user.id;

    const existingProject = await prisma.project.findFirst({
      where: { id, userId }
    });

    if (!existingProject) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        githubRepo,
        githubBranch
      }
    });

    res.status(200).json({ message: "Project updated successfully", project });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete project
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const existingProject = await prisma.project.findFirst({
      where: { id, userId }
    });

    if (!existingProject) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Delete related records first
    await prisma.webhookEvent.deleteMany({ where: { projectId: id } });
    await prisma.deployment.deleteMany({ where: { projectId: id } });
    await prisma.project.delete({ where: { id } });

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get deployments for a project
export const getProjectDeployments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id, userId }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const deployments = await prisma.deployment.findMany({
      where: { projectId: id },
      include: {
        project: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ deployments });
  } catch (error) {
    console.error("Get deployments error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Regenerate webhook secret
export const regenerateWebhookSecret = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const existingProject = await prisma.project.findFirst({
      where: { id, userId }
    });

    if (!existingProject) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Generate new webhook secret
    const newWebhookSecret = crypto.randomBytes(32).toString('hex');

    const project = await prisma.project.update({
      where: { id },
      data: {
        webhookSecret: newWebhookSecret,
        webhookConnected: false, // Reset connection status
        updatedAt: new Date()
      }
    });

    res.status(200).json({ 
      message: "Webhook secret regenerated successfully", 
      webhookSecret: newWebhookSecret,
      webhookUrl: `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3000'}/api/webhook/github/${project.id}`
    });
  } catch (error) {
    console.error("Regenerate webhook secret error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Trigger manual deployment
export const triggerManualDeployment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { commitHash, commitMsg } = req.body;
    const userId = (req as any).user.id;

    const project = await prisma.project.findFirst({
      where: { id, userId }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        projectId: id,
        userId,
        commitHash: commitHash || 'manual-deploy',
        commitMsg: commitMsg || 'Manual deployment trigger',
        status: "PENDING",
        triggeredBy: "manual"
      }
    });

    // Here you would integrate with your actual deployment system
    // For now, we'll simulate accepting the deployment
    setTimeout(async () => {
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: "ACCEPTED" }
      });
    }, 1000);

    res.status(201).json({ 
      message: "Manual deployment triggered successfully", 
      deployment 
    });
  } catch (error) {
    console.error("Trigger manual deployment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
