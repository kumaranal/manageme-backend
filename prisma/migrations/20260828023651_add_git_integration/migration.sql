-- CreateEnum
CREATE TYPE "GitProvider" AS ENUM ('GITHUB');

-- CreateEnum
CREATE TYPE "PrState" AS ENUM ('NONE', 'OPEN', 'DRAFT', 'MERGED', 'CLOSED');

-- CreateTable
CREATE TABLE "git_connections" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "GitProvider" NOT NULL DEFAULT 'GITHUB',
    "installationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "connectedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "git_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_repos" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "gitConnectionId" TEXT NOT NULL,
    "repoId" INTEGER NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "linkedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_branches" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "projectRepoId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "prNumber" INTEGER,
    "prState" "PrState" NOT NULL DEFAULT 'NONE',
    "prUrl" TEXT,
    "prTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "git_connections_orgId_key" ON "git_connections"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "project_repos_projectId_key" ON "project_repos"("projectId");

-- CreateIndex
CREATE INDEX "issue_branches_issueId_idx" ON "issue_branches"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_branches_projectRepoId_branchName_key" ON "issue_branches"("projectRepoId", "branchName");

-- AddForeignKey
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repos" ADD CONSTRAINT "project_repos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repos" ADD CONSTRAINT "project_repos_gitConnectionId_fkey" FOREIGN KEY ("gitConnectionId") REFERENCES "git_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repos" ADD CONSTRAINT "project_repos_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_branches" ADD CONSTRAINT "issue_branches_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_branches" ADD CONSTRAINT "issue_branches_projectRepoId_fkey" FOREIGN KEY ("projectRepoId") REFERENCES "project_repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_branches" ADD CONSTRAINT "issue_branches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
