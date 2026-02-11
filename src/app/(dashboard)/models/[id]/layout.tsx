'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface ModelLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function ModelLayout({ children, params }: ModelLayoutProps) {
  const pathname = usePathname();
  const { id } = React.use(params);

  const { data: model, isLoading } = trpc.model.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const tabs = [
    { label: 'Info', href: `/models/${id}`, exact: true },
    {
      label: `Photos (${model?.previewPhotos?.length || 0})`,
      href: `/models/${id}/photos`,
    },
    {
      label: `Products (${model?.products?.length || 0})`,
      href: `/models/${id}/products`,
    },
  ];

  const isActiveTab = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Check if we're on a product detail page
  const isProductDetail = pathname.match(/\/models\/[^/]+\/products\/[^/]+$/);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Model not found</p>
        <Link href="/models" className="text-primary hover:underline">
          Back to models
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/models" className="hover:text-foreground transition-colors">
          Models
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          href={`/models/${id}`}
          className={cn(
            'hover:text-foreground transition-colors',
            !isProductDetail && 'text-foreground font-medium'
          )}
        >
          {model.name}
        </Link>
        {isProductDetail && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Link
              href={`/models/${id}/products`}
              className="hover:text-foreground transition-colors"
            >
              Products
            </Link>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/models"
          className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{model.name}</h1>
          <p className="text-muted-foreground">@{model.username}</p>
        </div>
      </div>

      {/* Tab Navigation - hide on product detail pages */}
      {!isProductDetail && (
        <nav className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                isActiveTab(tab.href, tab.exact)
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
