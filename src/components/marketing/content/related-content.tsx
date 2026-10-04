import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export interface RelatedItem {
  title: string;
  description: string;
  href: string;
  badge: string; // Guide / Glossary / Use Case / Tool
}

export function RelatedContent({ items, title = "Related" }: { items: RelatedItem[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="related-heading" className="mt-12">
      <h2 id="related-heading" className="text-sm font-semibold">
        {title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href as never} className="group">
            <Card className="h-full hover:bg-surface-muted/50 transition-colors">
              <CardHeader>
                <Badge variant="secondary" className="w-fit text-[10px]">{item.badge}</Badge>
                <CardTitle className="text-sm mt-2 group-hover:text-primary transition-colors flex items-center gap-2">
                  {item.title} <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
                <CardDescription className="line-clamp-2">{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
