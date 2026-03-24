import { useState } from "react";
import { X } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { FilesNav } from "@/components/files/files-nav";
import { FileList } from "@/components/files/file-list";
import { FileDetails } from "@/components/files/file-details";
import { FileUploadArea } from "@/components/files/file-upload-area";
import { useFilesPageStore } from "@/stores/files-page-store";
import { useMobile } from "@/hooks/use-mobile";

export function FilesPage() {
  const { activeTab, setActiveTab, selectedFileId } = useFilesPageStore();
  const isMobile = useMobile();
  const [showDetails, setShowDetails] = useState(false);

  if (isMobile) {
    return (
      <AppLayout showToolPanel={false}>
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Mobile tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("recent")}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTab === "recent"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTab === "upload"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              Upload
            </button>
          </div>

          {activeTab === "recent" ? (
            <div className="flex-1 overflow-hidden" onClick={() => { if (selectedFileId) setShowDetails(true); }}>
              <FileList />
            </div>
          ) : (
            <FileUploadArea />
          )}

          {/* Mobile detail bottom sheet */}
          {showDetails && selectedFileId && (
            <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowDetails(false)}>
              <div
                className="absolute bottom-0 left-0 right-0 bg-background rounded-t-xl p-4 max-h-[70vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold">File Details</span>
                  <button onClick={() => setShowDetails(false)}>
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <FileDetails mobile />
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showToolPanel={false}>
      <div className="flex h-full w-full overflow-hidden">
        <FilesNav />
        {activeTab === "recent" ? (
          <>
            <FileList />
            <FileDetails />
          </>
        ) : (
          <FileUploadArea />
        )}
      </div>
    </AppLayout>
  );
}
